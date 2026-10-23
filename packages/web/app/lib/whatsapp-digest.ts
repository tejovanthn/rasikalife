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
  return artist.role ? `${name} (${plain(artist.role)})` : name;
}

function eventBlock(event: DigestEvent, opts: DigestOptions): string[] {
  const artists = event.artists ?? [];
  // A title such as "Carnatic Vocal Concert" says nothing a reader can act on, so the
  // performers lead instead, the way the event card does it.
  const generic = isGenericTitle(event.title, artists, event.artForm ?? undefined);
  const lead =
    generic && artists.length > 0 ? artists.map(a => plain(a.name)).join(', ') : plain(event.title);

  const lines = [`*${lead}*`];
  if (opts.cast !== false && artists.length > 0) {
    lines.push(artists.map(performer).join(', '));
  }
  if (event.venueName) lines.push(`📍 ${plain(event.venueName)}`);

  // Pasted text has no reader zone to compare with, so only a concert outside India is
  // labelled: the group reading it is almost always in India.
  const zone = eventZone(event);
  const time = needsZoneLabel(event.startDateTime, zone)
    ? `${formatEventTime(event.startDateTime, zone)} ${zoneLabel(event.startDateTime, zone)}`
    : formatEventTime(event.startDateTime, zone);
  const entry = event.entryType ? ENTRY_LABELS[event.entryType] : undefined;
  lines.push(`🕕 ${[time, entry].filter(Boolean).join(' · ')}`);

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
