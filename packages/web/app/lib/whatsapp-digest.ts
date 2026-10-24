import { roleLabel } from '~/lib/artist-display';
import {
  eventZone,
  formatDayLabel,
  formatEventTime,
  groupByEventDate,
  needsZoneLabel,
  zoneLabel,
} from '~/lib/event-time';
import { isGenericTitle } from '~/lib/generic-title';

/**
 * A concert listing as plain text for a WhatsApp group, which is where concert news actually
 * travels between rasikas. Built from stored fields only, so it claims nothing the event pages
 * do not.
 *
 * WhatsApp renders `*bold*` and `_italic_`, so those characters are taken out of stored text
 * before it is wrapped: a name with an underscore would otherwise italicise half a line.
 */

export interface DigestEvent {
  id: string;
  title: string;
  startDateTime: string;
  timezone?: string | null;
  venueName?: string | null;
  artists?: Array<{ title?: string | null; name: string; role?: string | null }> | null;
  artForm?: string | null;
  entryType?: string | null;
  ticketing?: { url?: string | null } | null;
}

export interface DigestOptions {
  heading: string;
  /** The listing these events came from, on rasika.life. Always the last line. */
  listingUrl: string;
  eventUrl: (event: DigestEvent) => string;
  /** One line naming every performer and instrument. On by default. */
  cast?: boolean;
  /** A rasika.life link under each event. Off by default: it doubles the length. */
  links?: boolean;
  /** Past this many events the text stops and points at the listing. */
  max?: number;
  /** `utm_campaign` on every rasika.life link in the text: `listing_share`, `festival_share`. */
  campaign: string;
}

/**
 * Tags a rasika.life link so GA4 can count the readers a pasted text brings back. Only our own
 * links: a ticket link belongs to someone else. `utm_content` says which link in the text it
 * was, the listing or one event.
 */
export function withUtm(url: string, campaign: string, content: 'listing' | 'event'): string {
  const parsed = new URL(url);
  parsed.searchParams.set('utm_source', 'whatsapp');
  parsed.searchParams.set('utm_medium', 'social');
  parsed.searchParams.set('utm_campaign', campaign);
  parsed.searchParams.set('utm_content', content);
  return parsed.toString();
}

export const DIGEST_MAX_EVENTS = 30;

const ENTRY_LABELS: Record<string, string> = {
  free: 'Free',
  ticketed: 'Ticketed',
  'by-invitation': 'By invitation',
};

function plain(text: string): string {
  return text
    .replace(/[*_~`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function performer(artist: { title?: string | null; name: string; role?: string | null }) {
  const name = plain([artist.title, artist.name].filter(Boolean).join(' '));
  // Roles are stored as slugs ("chief-guest"); a reader in a group should see words.
  const role = artist.role ? plain(roleLabel(artist.role)) : '';
  return role ? `${name} (${role})` : name;
}

/**
 * The first line of the text. It names the actual dates, not only "This weekend": a pasted
 * text is read days later, scrolled back to in a group, when "this weekend" means another
 * weekend. A label that already holds a date (a day, a month) is not given it twice.
 */
export function digestHeading(opts: {
  cityName?: string;
  range?: { from: string; to: string; label: string } | null;
  free?: boolean;
}): string {
  const where = opts.cityName ? ` in ${opts.cityName}` : '';
  const { range } = opts;
  if (!range) return `${opts.free ? 'Upcoming free concerts' : 'Upcoming concerts'}${where}`;
  const what = `${opts.free ? 'Free concerts' : 'Concerts'}${where}`;
  if (/\d/.test(range.label)) return `${what} · ${range.label}`;
  const dates =
    range.from === range.to
      ? formatDayLabel(range.from)
      : `${formatDayLabel(range.from)} – ${formatDayLabel(range.to)}`;
  return `${what} · ${range.label}, ${dates}`;
}

function eventBlock(event: DigestEvent, opts: DigestOptions): string[] {
  const artists = event.artists ?? [];
  // A title such as "Carnatic Vocal Concert" says nothing a reader can act on, so the
  // performers lead instead, the way the event card does it.
  const generic = isGenericTitle(event.title, artists, event.artForm ?? undefined);
  // With the cast line on, that lead would be the cast line again without the roles, so the
  // cast itself becomes the lead and every name is printed once.
  const cast = opts.cast !== false && artists.length > 0;
  const lines: string[] = [];
  if (generic && artists.length > 0) {
    lines.push(
      cast
        ? `*${artists.map(performer).join(', ')}*`
        : `*${artists.map(a => plain(a.name)).join(', ')}*`
    );
  } else {
    lines.push(`*${plain(event.title)}*`);
    if (cast) lines.push(artists.map(performer).join(', '));
  }
  if (event.venueName) lines.push(`📍 ${plain(event.venueName)}`);

  // Pasted text has no reader zone to compare with, so only a concert outside India is
  // labelled: the group reading it is almost always in India.
  const zone = eventZone(event);
  const time = needsZoneLabel(event.startDateTime, zone)
    ? `${formatEventTime(event.startDateTime, zone)} ${zoneLabel(event.startDateTime, zone)}`
    : formatEventTime(event.startDateTime, zone);
  const entry = event.entryType ? ENTRY_LABELS[event.entryType] : undefined;
  // A neutral clock: 🕕 showed six o'clock beside a 9:30 am concert.
  lines.push(`⏰ ${[time, entry].filter(Boolean).join(' · ')}`);

  const ticketUrl = event.ticketing?.url?.trim();
  if (event.entryType === 'ticketed' && ticketUrl && /^https?:\/\//.test(ticketUrl)) {
    lines.push(`🎟 ${ticketUrl}`);
  }
  if (opts.links) lines.push(withUtm(opts.eventUrl(event), opts.campaign, 'event'));
  return lines;
}

export function formatWhatsAppDigest(events: DigestEvent[], opts: DigestOptions): string {
  const max = opts.max ?? DIGEST_MAX_EVENTS;
  const shown = events.slice(0, max);
  const out: string[] = [`*${plain(opts.heading)}*`];

  if (shown.length === 0) {
    out.push('', 'Nothing listed yet.');
  }

  for (const group of groupByEventDate(shown)) {
    out.push('', `── ${formatDayLabel(group.date)} ──`);
    for (const event of group.events) {
      out.push('', ...eventBlock(event, opts));
    }
  }

  const rest = events.length - shown.length;
  const listingUrl = withUtm(opts.listingUrl, opts.campaign, 'listing');
  out.push(
    '',
    rest > 0 ? `…and ${rest} more: ${listingUrl}` : `More on Rasika.life: ${listingUrl}`
  );
  return out.join('\n');
}

/** A `wa.me` link that opens WhatsApp with the text filled in, no JavaScript needed. */
export function whatsAppShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/**
 * The longest `wa.me` link we hand out. Past roughly 2,000 to 4,000 characters some Android
 * builds open WhatsApp with the text cut off or empty, and the reader cannot tell. 3,500 keeps
 * the common case (a weekend in one city) whole while staying under where the reports start.
 * Copy has no such limit, which is why it stays the first button.
 */
export const WHATSAPP_URL_LIMIT = 3500;

const FOOTER = /^(?:…and (\d+) more|More on Rasika\.life): (\S+)$/;

/**
 * "Open in WhatsApp" for a digest: the whole text when its link fits under `limit`, otherwise
 * the same text with events dropped from the end and the footer counting them, so the reader
 * still gets the link to the rest. Works on the text `formatWhatsAppDigest` builds, so the
 * component needs nothing else from the loader. `shortened` says whether Copy has more.
 */
export function whatsAppOpenLink(
  text: string,
  limit = WHATSAPP_URL_LIMIT
): { url: string; shortened: boolean } | null {
  const whole = whatsAppShareUrl(text);
  if (whole.length <= limit) return { url: whole, shortened: false };

  const lines = text.split('\n');
  const footer = FOOTER.exec(lines[lines.length - 1] ?? '');
  if (!footer) return null;
  const [, already, listingUrl] = footer;
  // Between the heading and the footer: day headers and event blocks, one blank line apart.
  const chunks = lines
    .slice(1, -1)
    .join('\n')
    .split('\n\n')
    .map(c => c.trim())
    .filter(Boolean);
  let dropped = 0;

  while (chunks.some(c => c.startsWith('*'))) {
    const last = chunks.pop() ?? '';
    if (last.startsWith('*')) dropped++;
    // A day header left with nothing under it goes too.
    while (chunks.length > 0 && chunks[chunks.length - 1]?.startsWith('── ')) chunks.pop();
    if (!chunks.some(c => c.startsWith('*'))) break;
    const rest = Number(already ?? 0) + dropped;
    const short = [lines[0], '', chunks.join('\n\n'), '', `…and ${rest} more: ${listingUrl}`].join(
      '\n'
    );
    const url = whatsAppShareUrl(short);
    if (url.length <= limit) return { url, shortened: true };
  }
  return null;
}
