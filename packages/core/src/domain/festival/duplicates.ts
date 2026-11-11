/**
 * "Is this festival already listed?" for a submission that is about to create one.
 *
 * One festival was entered twice from two posters ("Chowdiah Utsava" and "Chowdiah Utsava - Sri
 * K. K. Murthy Memorial…"), and every concert in it went in twice with it. Names are compared
 * with the place-dedup keys (honorifics, city, spelling variants), but a festival name usually
 * *grows* between posters rather than changing, so containment is allowed to add more than the
 * three extra words `wordsSubsetOf` permits for halls. Dates must overlap; the same name a year
 * apart is the next edition, not a copy.
 *
 * Browser-safe and pure.
 */
import {
  collapseSpelling,
  isNearMatch,
  placeExactKey,
  placeVariantKey,
  placeWords,
} from '../../shared/place-dedup';

export interface FestivalCandidate {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status?: string | null;
  deletedAt?: string | null;
  mergedIntoId?: string | null;
}

const LISTED = new Set(['approved', 'submitted']);

/** Whole days; only the date part counts, so `2026-11-10T00:00` and `2026-11-10` agree. */
const day = (value: string): string => value.slice(0, 10);

export function festivalDatesOverlap(
  a: { startDate: string; endDate: string },
  b: { startDate: string; endDate: string }
): boolean {
  return day(a.startDate) <= day(b.endDate) && day(b.startDate) <= day(a.endDate);
}

/** One name's significant words all appear in the other's. At least two words and 8 letters. */
function containsName(a: string, b: string): boolean {
  const [inner, outer] =
    placeWords(a).length <= placeWords(b).length
      ? [placeWords(a), placeWords(b)]
      : [placeWords(b), placeWords(a)];
  if (inner.length < 2 || inner.join('').length < 8) return false;
  const have = new Set(outer.map(collapseSpelling));
  return inner.every(word => have.has(collapseSpelling(word)));
}

export function similarFestivalNames(a: string, b: string): boolean {
  const [ka, kb] = [placeExactKey(a), placeExactKey(b)];
  if (!ka || !kb) return false;
  return (
    ka === kb ||
    placeVariantKey(a) === placeVariantKey(b) ||
    isNearMatch(ka, kb) ||
    containsName(a, b)
  );
}

/** Festivals that look like `target`: similar name and overlapping dates, soonest start first. */
export function findSimilarFestivals<T extends FestivalCandidate>(
  candidates: T[],
  target: { id?: string; name: string; startDate: string; endDate: string }
): T[] {
  return candidates
    .filter(c => c.id !== target.id && !c.deletedAt && !c.mergedIntoId)
    .filter(c => LISTED.has(c.status ?? ''))
    .filter(c => festivalDatesOverlap(c, target) && similarFestivalNames(c.name, target.name))
    .sort((x, y) => day(x.startDate).localeCompare(day(y.startDate)));
}

/** Keeper of two festivals: live over waiting, then more events, then the older row. */
export function suggestFestivalKeeper<
  T extends { id: string; status?: string | null; createdAt?: string; eventCount?: number },
>(a: T, b: T): { keeper: T; loser: T } {
  const live = (f: T) => (f.status === 'approved' ? 1 : 0);
  const age = (f: T) => Date.parse(f.createdAt ?? '') || Number.MAX_SAFE_INTEGER;
  const keepA =
    live(a) !== live(b)
      ? live(a) > live(b)
      : (a.eventCount ?? 0) !== (b.eventCount ?? 0)
        ? (a.eventCount ?? 0) > (b.eventCount ?? 0)
        : age(a) !== age(b)
          ? age(a) < age(b)
          : a.id < b.id;
  return keepA ? { keeper: a, loser: b } : { keeper: b, loser: a };
}
