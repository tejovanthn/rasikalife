import { formatEventDate } from './utils';

/**
 * Meta descriptions for pages that are really a listing — a venue, an organiser.
 *
 * These pages were describing themselves and not their contents: "Events and
 * performances at Chowdiah Memorial Hall. Indian classical arts venue." promises
 * a listing without naming one thing in it. Search Console shows what that costs
 * — venue pages take 1,414 impressions at 0.99% CTR, and
 * "chowdiah memorial hall events" alone is 196 impressions at position 9.8 with
 * no clicks at all. Somebody typing a hall's name plus "events" is asking what is
 * on; the snippet has to answer it.
 *
 * So the count and the next date go in the description. Same principle as putting
 * an arohanam in a raga's.
 */

/** Google truncates around here, and a clause cut mid-word reads as broken. */
const MAX_LENGTH = 155;

export type ListingEvent = {
  title: string;
  startDateTime: string;
};

type Options = {
  /** Venue or organiser name, already display-formatted. */
  name: string;
  events: ListingEvent[];
  /** "at" for a venue, "by" for an organiser. */
  preposition: 'at' | 'by';
  /** Trailing sentence when there is nothing to list. */
  fallback: string;
  /** City and state, when stored. Many venues have neither. */
  location?: string;
  /** Injectable for tests. */
  now?: Date;
};

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

/** Trim on a word boundary so a truncated description does not end mid-word. */
function clamp(text: string): string {
  if (text.length <= MAX_LENGTH) return text;
  const cut = text.slice(0, MAX_LENGTH);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[,.\s]+$/, '')}…`;
}

export function eventListingDescription({
  name,
  events,
  preposition,
  fallback,
  location,
  now = new Date(),
}: Options): string {
  const where = `${name}${location ? `, ${location}` : ''}`;
  const cutoff = now.getTime();

  const upcoming = events
    .filter(e => new Date(e.startDateTime).getTime() >= cutoff)
    .sort((a, b) => new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime());

  if (upcoming.length > 0) {
    const next = upcoming[0];
    const lead = `${plural(upcoming.length, 'upcoming event')} ${preposition} ${where}.`;
    return clamp(`${lead} Next: ${next.title} on ${formatEventDate(next.startDateTime)}.`);
  }

  // A hall with only past concerts is still the right answer for "<hall> events",
  // so say what is there rather than falling back to the generic line.
  const past = events
    .filter(e => new Date(e.startDateTime).getTime() < cutoff)
    .sort((a, b) => new Date(b.startDateTime).getTime() - new Date(a.startDateTime).getTime());

  if (past.length > 0) {
    const recent = past[0];
    const lead = `${plural(past.length, 'past event')} ${preposition} ${where}.`;
    return clamp(
      `${lead} Most recent: ${recent.title} on ${formatEventDate(recent.startDateTime)}.`
    );
  }

  return clamp(`Events and performances ${preposition} ${where}. ${fallback}`);
}
