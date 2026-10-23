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

/** Join names as "A", "A and B", or "A, B and C". */
function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * Title and description for `/events`, the upcoming-events listing.
 *
 * The old title, "Upcoming Events - Indian Classical Arts", held none of the
 * words people search with. Keyword Planner (IN + US) shows "carnatic music"
 * at 22,200 a month and "classical music concerts near me" at 1,300, and the
 * page sat at position 20 for 825 impressions. So the title says "Carnatic
 * concerts", and the description names the count and the cities that are
 * actually listed, which also makes it change as the listing changes.
 */
export function eventsIndexMeta({
  count,
  cities,
  city,
}: {
  /** Upcoming events on the page, after any city filter. */
  count: number;
  /** Cities with the most upcoming events, busiest first. */
  cities: string[];
  /** The `?city=` filter, when set. */
  city?: string;
}): { title: string; description: string } {
  if (city) {
    const title = `Carnatic Concerts in ${city} | Rasika.life`;
    const lead =
      count > 0
        ? `${plural(count, 'upcoming event')} in ${city}: Carnatic concerts and other classical arts.`
        : `Carnatic concerts and classical arts events in ${city}.`;
    return { title, description: clamp(`${lead} See the date, venue and artists for each.`) };
  }

  const title = 'Carnatic Concerts and Classical Music Events | Rasika.life';
  const where = cities.length > 0 ? ` in ${joinNames(cities.slice(0, 3))}` : '';
  const lead =
    count > 1
      ? `${count} upcoming Carnatic concerts and classical music and dance events${where}.`
      : `Upcoming Carnatic concerts and classical music and dance events${where}.`;
  return { title, description: clamp(`${lead} See the date, venue and artists for each.`) };
}

/**
 * Title and description for `/<city>/concerts` and its date pages
 * ("carnatic concerts in bangalore this weekend"). Names the count and the next concert, the
 * fact a searcher came for, rather than describing the kind of page; when the range is empty
 * it says so and names the next concert after it, which the page also lists.
 */
export function cityConcertsMeta({
  city,
  range,
  count,
  next,
}: {
  city: string;
  /** "Today", "This weekend", "This week", or absent for all upcoming. */
  range?: string;
  count: number;
  /** The first concert the page shows. */
  next?: { name: string; day: string; venue?: string };
}): { title: string; description: string } {
  const when = range ? ` ${range.replace(/\b\w/g, c => c.toUpperCase())}` : '';
  const title = `Carnatic Concerts in ${city}${when} | Rasika.life`;
  const scope = range ? range.toLowerCase() : 'coming up';
  const lead =
    count > 0
      ? `${plural(count, 'concert')} in ${city} ${scope}.`
      : `No concerts listed in ${city} ${scope} yet.`;
  const nextLine = next
    ? ` ${count > 0 ? 'First' : 'Next'}: ${next.name}, ${next.day}${next.venue ? ` at ${next.venue}` : ''}.`
    : '';
  return { title, description: clamp(`${lead}${nextLine} Date, venue and artists for each.`) };
}
