import { DEFAULT_EVENT_TIMEZONE } from '../domain/event/schema';
import { isGenericTitle } from './generic-title';

/**
 * What the text card for a poster-less event says. One pure function feeds both the HTML card on
 * the event page and the 1200x630 share image (packages/og-image), so the two cannot drift.
 *
 * It claims nothing the record does not hold: a field that is empty is absent from the result,
 * never filled with a guess. Dates and times are printed in the event's own zone (the Lambdas
 * run in UTC; see web `lib/event-time.ts`).
 */

export interface EventCardInput {
  title: string;
  startDateTime: string;
  endDateTime?: string | null;
  timezone?: string | null;
  artForm?: string | null;
  artists?: Array<{ title?: string | null; name: string; role?: string | null }> | null;
  venueName?: string | null;
  /** From the venue record. The event itself holds no city. */
  city?: string | null;
}

export interface EventCardArtist {
  /** `Vid. Sunil Gargyan` */
  name: string;
  /** `violin`. Absent when the record gives none. */
  role?: string;
}

export interface EventCardContent {
  title: string;
  artists: EventCardArtist[];
  /** Artists named in the record but cut to fit. */
  moreArtists: number;
  /** `Sat, 12 Dec, 2026` */
  date?: string;
  /** `6:00 pm – 8:30 pm`, with the zone named outside India. Absent if the instant is unusable. */
  time?: string;
  /** `Narada Gana Sabha, Chennai` */
  place?: string;
}

export const CARD_TITLE_MAX = 90;
export const CARD_ARTIST_MAX = 4;
export const CARD_NAME_MAX = 44;

/**
 * The `roman` display script: letters with their combining marks removed (`Śrīvidyā` becomes
 * `Srividya`). It is what DEFAULT_DISPLAY_SCRIPT gives every shared and indexed surface, and how
 * people spell and search these names. Event text is stored as typed, not as ITRANS, so this is
 * the strip step of `toRoman` in `utils/transliteration.ts` without the ITRANS conversion.
 */
export function romanize(text: string): string {
  return text.normalize('NFKD').replace(/\p{M}/gu, '').normalize('NFC');
}

const clean = (s?: string | null) => romanize((s ?? '').replace(/\s+/g, ' ').trim());

/** Cut at a limit with an ellipsis, so the cut shows. */
export function truncate(text: string, max: number): string {
  const chars = [...text];
  return chars.length <= max
    ? text
    : `${chars
        .slice(0, max - 1)
        .join('')
        .trimEnd()}…`;
}

/** Billing positions, not instruments; kept in step with web's `GENERIC_ROLES`. */
const GENERIC_ROLES = new Set(['main', 'accompanist', 'performer', 'artist', 'artiste']);

const roleText = (role?: string | null) => {
  const text = clean(role?.replace(/[-_]+/g, ' ')).toLowerCase();
  return text && !GENERIC_ROLES.has(text) ? text : undefined;
};

function displayName(a: { title?: string | null; name: string }): string {
  return clean(`${a.title ? `${clean(a.title)} ` : ''}${a.name}`);
}

function formatDay(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatTime(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function zoneName(iso: string, timeZone: string): string {
  return (
    new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short', hour: 'numeric' })
      .formatToParts(new Date(iso))
      .find(p => p.type === 'timeZoneName')?.value ?? ''
  );
}

export function buildEventCardContent(event: EventCardInput): EventCardContent {
  const zone = event.timezone || DEFAULT_EVENT_TIMEZONE;
  const people = (event.artists ?? [])
    .filter(a => clean(a.name))
    .map(a => ({ name: displayName(a), role: roleText(a.role) }));

  // A generic title ("Carnatic Music Concert") says nothing the cast line does not, so the
  // headline becomes the lead artist, then the venue, as the listing rows do.
  const rawTitle = clean(event.title);
  const venue = clean(event.venueName);
  let title = rawTitle;
  let cast = people;
  if (isGenericTitle(rawTitle, event.artists ?? undefined, event.artForm ?? undefined)) {
    if (people.length > 0) {
      title = people[0].name;
      cast = people.slice(1);
    } else if (venue) {
      title = venue;
    }
  }

  const shown = cast.slice(0, CARD_ARTIST_MAX).map(a => ({
    name: truncate(a.name, CARD_NAME_MAX),
    ...(a.role ? { role: a.role } : {}),
  }));

  const start = new Date(event.startDateTime);
  const valid = !Number.isNaN(start.getTime());
  let time: string | undefined;
  if (valid) {
    const end = event.endDateTime ? new Date(event.endDateTime) : null;
    const endOk = end && !Number.isNaN(end.getTime()) && end > start;
    const range = endOk
      ? `${formatTime(event.startDateTime, zone)} – ${formatTime(event.endDateTime as string, zone)}`
      : formatTime(event.startDateTime, zone);
    const label = zone !== DEFAULT_EVENT_TIMEZONE ? zoneName(event.startDateTime, zone) : '';
    time = label ? `${range} ${label}` : range;
  }

  const city = clean(event.city);
  const place =
    venue && city && !venue.toLowerCase().includes(city.toLowerCase())
      ? `${venue}, ${city}`
      : venue || city || undefined;

  return {
    title: truncate(title, CARD_TITLE_MAX),
    artists: shown,
    moreArtists: Math.max(0, cast.length - shown.length),
    ...(valid ? { date: formatDay(event.startDateTime, zone) } : {}),
    ...(time ? { time } : {}),
    ...(place ? { place } : {}),
  };
}
