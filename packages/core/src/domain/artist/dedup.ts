/**
 * Shared artist find-or-create dedup helper.
 *
 * Artist names arrive from event posters and scrapes, so near-duplicates
 * ("T M Krishna" / "T.M. Krishna" / "Sri T M Krishna" / "Krishna, T M") each
 * risk creating a new record if we only ever do an exact-name lookup. This
 * module adds a normalization + fuzzy-matching layer on top of the existing
 * exact `getArtistByName` lookup, plus `findOrCreateArtist` to tie the two
 * together for callers that today blind-create on a miss.
 */

import { createArtist, getArtistByName, listArtists } from '.';
import type { Artist } from './entity';

const DEFAULT_THRESHOLD = 0.85;

// Multiplier applied when two names have no initials relationship AND their
// surnames (last token) differ. Without this, a one-character surname
// difference on an otherwise identical name (e.g. "Krishna" vs "Krishnan")
// scores ~0.92 on plain edit distance alone — above the default threshold —
// even though these are routinely different people. A wrong fuzzy match
// silently fuses two artists; a missed one only leaves a duplicate that
// `mergeArtist` can fix later. We would rather create a duplicate than merge
// two careers, so a surname mismatch is penalized on top of edit distance.
const DIFFERING_SURNAME_PENALTY = 0.9;

const HONORIFICS = new Set([
  'sri',
  'shri',
  'sree',
  'smt',
  'srimati',
  'dr',
  'prof',
  'vidwan',
  'vidushi',
  'kum',
  'kumari',
  'master',
  'guru',
  'pandit',
  'ustad',
  'thiru',
  'selvi',
]);

/**
 * Lowercase, trim, collapse whitespace, strip `.`/`,` punctuation, and strip
 * leading honorifics (possibly stacked, e.g. "Dr Smt X" -> "x").
 *
 * We deliberately do NOT reorder "Lastname, Firstname" input (e.g.
 * "Krishna, T M" stays "krishna t m" rather than becoming "t m krishna") —
 * see the report for why that case is left unhandled.
 */
export function normalizeArtistName(raw: string): string {
  const collapsed = raw.toLowerCase().replace(/[.,]/g, ' ').trim().replace(/\s+/g, ' ');

  if (collapsed === '') return '';

  const tokens = collapsed.split(' ');
  let start = 0;
  // Guard `start < tokens.length - 1` so a name that is entirely honorific
  // words (e.g. a lone "Guru") still keeps its last token instead of
  // normalizing to an empty string.
  while (start < tokens.length - 1 && HONORIFICS.has(tokens[start])) {
    start++;
  }

  return tokens.slice(start).join(' ');
}

function tokensOf(name: string): string[] {
  const normalized = normalizeArtistName(name);
  return normalized === '' ? [] : normalized.split(' ');
}

// True when `x` and `y` are the same token, or one is a single-letter initial
// matching the other's first letter.
function tokenMatches(x: string, y: string): boolean {
  if (x === y) return true;
  if (x.length === 1 && x === y[0]) return true;
  if (y.length === 1 && y === x[0]) return true;
  return false;
}

/**
 * True when one name is the initial form of the other: the surname (last
 * token) matches exactly, and every leading token on one side is either
 * identical to, or a single-letter initial of, the corresponding token on
 * the other side. Requires both names to have the same token count — a
 * given name abbreviated to fewer initials than the other side (e.g. "T
 * Krishna" vs "Thodur Madabusi Krishna") is not considered a match; see the
 * report.
 */
export function initialsMatch(a: string, b: string): boolean {
  const ta = tokensOf(a);
  const tb = tokensOf(b);

  if (ta.length < 2 || tb.length < 2) return false;
  if (ta.length !== tb.length) return false;
  if (ta[ta.length - 1] !== tb[tb.length - 1]) return false;

  for (let i = 0; i < ta.length - 1; i++) {
    if (!tokenMatches(ta[i], tb[i])) return false;
  }

  return true;
}

// Levenshtein-based similarity, 1 = identical, 0 = completely different.
// Not reused from event-setlist/reconcile.ts because that module doesn't
// export its version; this is a small local equivalent.
function levenshteinSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  let curr = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      curr[j] =
        a[i - 1] === b[j - 1] ? prev[j - 1] : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
    }
    [prev, curr] = [curr, prev];
  }

  return 1 - prev[b.length] / Math.max(a.length, b.length);
}

/**
 * 0..1 similarity of two artist names on their normalized forms. Exact
 * normalized equality is 1. An initials-form match (in either direction) is
 * boosted to at least 0.9, since the raw Levenshtein score of e.g. "T M
 * Krishna" vs "Thodur Madabusi Krishna" is otherwise low despite being the
 * same person. When there is no initials relationship, a surname mismatch
 * is penalized (see `DIFFERING_SURNAME_PENALTY`) so near-identical strings
 * that are actually different people don't score above threshold.
 */
export function artistNameSimilarity(a: string, b: string): number {
  const na = normalizeArtistName(a);
  const nb = normalizeArtistName(b);

  if (na === '' || nb === '') return 0;
  if (na === nb) return 1;

  if (initialsMatch(a, b)) return Math.max(levenshteinSimilarity(na, nb), 0.9);

  const base = levenshteinSimilarity(na, nb);
  const surnameA = na.split(' ').at(-1) ?? '';
  const surnameB = nb.split(' ').at(-1) ?? '';

  return surnameA === surnameB ? base : base * DIFFERING_SURNAME_PENALTY;
}

/**
 * Best candidate above `threshold` (default 0.85), or null. Considers each
 * candidate's `name` and `alternateNames`. Pure function, no I/O.
 */
export function findArtistMatch(
  name: string,
  candidates: Artist[],
  threshold = DEFAULT_THRESHOLD
): Artist | null {
  if (normalizeArtistName(name) === '') return null;

  let best: Artist | null = null;
  let bestScore = 0;

  for (const candidate of candidates) {
    const candidateNames = [candidate.name, ...(candidate.alternateNames ?? [])];
    for (const candidateName of candidateNames) {
      const score = artistNameSimilarity(name, candidateName);
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }
  }

  return bestScore >= threshold ? best : null;
}

// SCALING LIMIT: this pages through the *entire* artist table on every
// find-or-create miss. That's fine while the table is small, but it will not
// scale forever. The eventual fix is a prefix query on the `byName` GSI keyed
// on the normalized first token (e.g. the surname) so we only pull a small,
// plausible slice of candidates instead of the whole table. Not built now —
// keeping this simple until it's actually a problem.
async function collectAllArtistsForMatching(): Promise<Artist[]> {
  const artists: Artist[] = [];
  let nextToken: string | undefined;

  do {
    const page = await listArtists({ limit: 200, nextToken });
    artists.push(...page.items);
    nextToken = page.hasMore ? page.nextToken : undefined;
  } while (nextToken);

  return artists;
}

/**
 * Find-or-create wrapper: try an exact `getArtistByName` lookup first
 * (cheap), then fall back to fuzzy matching against all existing artists,
 * and only create a new record when nothing matches.
 *
 * With `dryRun: true`, no artist is created on a miss — the returned
 * `artist` is a placeholder (empty `id`) so callers doing a dry-run report
 * can still read `created`/`matchedOn` without touching the database.
 */
export async function findOrCreateArtist(
  name: string,
  opts?: { threshold?: number; dryRun?: boolean }
): Promise<{ artist: Artist; created: boolean; matchedOn?: string }> {
  const threshold = opts?.threshold ?? DEFAULT_THRESHOLD;
  const dryRun = opts?.dryRun ?? false;

  const exact = await getArtistByName(name);
  if (exact) {
    return { artist: exact, created: false, matchedOn: exact.name };
  }

  const candidates = await collectAllArtistsForMatching();
  const match = findArtistMatch(name, candidates, threshold);
  if (match) {
    return { artist: match, created: false, matchedOn: match.name };
  }

  if (dryRun) {
    const now = new Date().toISOString();
    const placeholder = { id: '', name, createdAt: now, updatedAt: now } as Artist;
    return { artist: placeholder, created: true };
  }

  const created = await createArtist({ name, gurus: [] });
  return { artist: created, created: true };
}
