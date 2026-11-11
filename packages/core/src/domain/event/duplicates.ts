/**
 * Concerts already listed at the same venue close to the same time: the "Is this the same
 * concert?" check on the verify step. The poster-hash check catches only the same file, and a
 * second poster of one concert (a WhatsApp forward, a re-crop, the sabha's own design) is the
 * ordinary case. Catching it here is cheaper than a `mergeEvent` afterwards, which loses the
 * second submitter's edits.
 *
 * Browser-safe and pure, so the window and the status rules are tested without a table.
 */

export const DUPLICATE_WINDOW_HOURS = 3;

export interface DuplicateCandidate {
  id: string;
  startDateTime: string;
  status?: string | null;
  mergedIntoId?: string | null;
  deletedAt?: string | null;
}

/**
 * Only an approved or submitted event counts. A draft is someone's unfinished upload, which
 * may be this very poster, and a rejected one was judged not to be a listing at all.
 */
const LISTED = new Set(['approved', 'submitted']);

export function nearDuplicates<T extends DuplicateCandidate>(
  candidates: T[],
  target: { startDateTime: string; excludeIds?: string[] },
  windowHours = DUPLICATE_WINDOW_HOURS
): T[] {
  const at = Date.parse(target.startDateTime);
  if (Number.isNaN(at)) return [];
  const exclude = new Set(target.excludeIds ?? []);
  const windowMs = windowHours * 60 * 60 * 1000;
  return candidates
    .filter(c => !exclude.has(c.id) && !c.mergedIntoId && !c.deletedAt)
    .filter(c => LISTED.has(c.status ?? ''))
    .map(c => ({ c, gap: Math.abs(Date.parse(c.startDateTime) - at) }))
    .filter(({ gap }) => gap <= windowMs)
    .sort((a, b) => a.gap - b.gap)
    .map(({ c }) => c);
}

/**
 * The `byVenue` sort-key range to read. Stored times carry their own offsets (`+05:30`, `Z`),
 * so string order is not time order within a day; reading whole days either side and
 * comparing instants in `nearDuplicates` is correct whatever offset each row was stored with.
 */
export function duplicateSearchRange(startDateTime: string): { from: string; to: string } | null {
  const at = Date.parse(startDateTime);
  if (Number.isNaN(at)) return null;
  const day = 24 * 60 * 60 * 1000;
  return {
    from: new Date(at - day).toISOString().slice(0, 10),
    to: new Date(at + 2 * day).toISOString().slice(0, 10),
  };
}

// ─── The blocking rule ───────────────────────────────────────────────────────────────────────
//
// `nearDuplicates` above is a soft warning: same venue, three hours. It cannot block, because two
// different concerts do share a hall on one evening. `findLikelyDuplicates` is tighter and it
// does block: same venue, start within 30 minutes, and some sign the two are one programme.
// The 2026-11 case: one festival entered twice from two posters, so "Flute Concert" and "Flute
// Concert by Sri. Amith A. Nadig" sat at the same hall at 17:30, and nothing refused the second.

export const LIKELY_WINDOW_MINUTES = 30;

export interface LikelyCandidate extends DuplicateCandidate {
  venueId?: string | null;
  title: string;
  artists?: Array<{ id?: string | null; name: string; role?: string | null }> | null;
  /** Ids a person confirmed are different events. Honoured from either side. */
  notDuplicateOf?: string[] | null;
}

export interface LikelyTarget {
  id?: string;
  venueId?: string | null;
  startDateTime: string;
  title: string;
  artists?: LikelyCandidate['artists'];
  notDuplicateOf?: string[] | null;
  excludeIds?: string[];
}

const NAME_HONORIFICS = new Set([
  'sri',
  'shri',
  'shree',
  'sree',
  'smt',
  'dr',
  'prof',
  'vidwan',
  'vidushi',
  'pandit',
  'pt',
  'late',
  'kum',
  'kumari',
  'master',
  'guru',
  'vid',
]);

/** Lower case, no punctuation, no leading honorific. Browser-safe: `artist/dedup.ts` is not. */
export function normaliseBilledName(raw: string): string {
  const tokens = raw
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
  let start = 0;
  while (start < tokens.length - 1 && NAME_HONORIFICS.has(tokens[start])) start++;
  return tokens.slice(start).join(' ');
}

function normaliseTitle(raw: string): string {
  return ` ${raw
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .join(' ')} `;
}

type Billed = NonNullable<LikelyCandidate['artists']>;

/** Both named, and one billed artist is the other's, by id or by normalised name. */
function sharesBilledArtist(a: Billed, b: Billed): boolean {
  const ids = new Set(a.map(x => x.id).filter((id): id is string => !!id));
  const names = new Set(a.map(x => normaliseBilledName(x.name)).filter(Boolean));
  return b.some(x => (x.id && ids.has(x.id)) || names.has(normaliseBilledName(x.name)));
}

/** The first billed artist is the main one; the title of the other side may carry the name. */
function titleNamesMainArtist(title: string, artists: Billed): boolean {
  const main = artists[0] && normaliseBilledName(artists[0].name);
  // Four characters keeps a bare initial or "Ram" from matching half the programme.
  if (!main || main.length < 4) return false;
  return normaliseTitle(title).includes(` ${main} `);
}

function sameProgramme(
  a: { title: string; artists: Billed },
  b: { title: string; artists: Billed }
): boolean {
  if (a.artists.length === 0 || b.artists.length === 0) return true;
  return (
    sharesBilledArtist(a.artists, b.artists) ||
    titleNamesMainArtist(a.title, b.artists) ||
    titleNamesMainArtist(b.title, a.artists)
  );
}

/**
 * Events that are probably this one listed twice. Pure. Closest start first. Left out: the
 * event itself, anything soft-deleted or merged, drafts and rejected rows (`LISTED`), another
 * venue, and any id a person already confirmed is different (`notDuplicateOf`, from either side).
 */
export function findLikelyDuplicates<T extends LikelyCandidate>(
  candidates: T[],
  target: LikelyTarget,
  windowMinutes = LIKELY_WINDOW_MINUTES
): T[] {
  const at = Date.parse(target.startDateTime);
  if (Number.isNaN(at) || !target.venueId) return [];
  const exclude = new Set([...(target.excludeIds ?? []), ...(target.id ? [target.id] : [])]);
  const confirmed = new Set(target.notDuplicateOf ?? []);
  const windowMs = windowMinutes * 60 * 1000;
  const mine = { title: target.title, artists: target.artists ?? [] };
  return candidates
    .filter(c => !exclude.has(c.id) && !confirmed.has(c.id) && !c.mergedIntoId && !c.deletedAt)
    .filter(c => LISTED.has(c.status ?? '') && c.venueId === target.venueId)
    .filter(c => !(target.id && c.notDuplicateOf?.includes(target.id)))
    .map(c => ({ c, gap: Math.abs(Date.parse(c.startDateTime) - at) }))
    .filter(({ gap }) => gap <= windowMs)
    .filter(({ c }) => sameProgramme(mine, { title: c.title, artists: c.artists ?? [] }))
    .sort((a, b) => a.gap - b.gap)
    .map(({ c }) => c);
}
