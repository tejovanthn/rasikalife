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

// Edit distance alone is the wrong metric for names: it charges one character
// for differences that are categorical rather than incremental. Two guards cap
// the score below DEFAULT_THRESHOLD so neither case can ever auto-match, while
// leaving the number usable for ranking if a caller deliberately lowers the
// bar to surface suggestions to a human.
//
// A wrong match silently fuses two artists; a missed one only leaves a
// duplicate that `mergeArtist` can fix. We would rather create a duplicate
// than merge two careers, so both guards err toward rejecting.

// Positional single-letter initials that differ, e.g. "N Ravikiran" vs
// "S Ravikiran" (0.91 on raw edit distance) or "T N Seshagopalan" vs
// "T V Seshagopalan" (0.94). In Carnatic naming the initials carry place and
// patronym, so a differing initial is strong evidence of a different person.
const DIFFERING_INITIAL_CAP = 0.5;

// Differing surnames, e.g. "Krishna" vs "Krishnan". A cap rather than a
// multiplier because a longer shared prefix would otherwise dilute the
// penalty: "Thodur Madabusi Krishna" vs "Thodur Madabusi Krishnan" scores
// 0.96 raw, and scaling that still clears the threshold.
const DIFFERING_SURNAME_CAP = 0.8;

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

// True when one side writes a run of initials without spaces and the other
// spaces them out: "TM Krishna" vs "T M Krishna". This is the only reason two
// names may legitimately differ in token count, so it is checked explicitly
// rather than left to edit distance.
function compressedInitialsMatch(givenA: string[], givenB: string[]): boolean {
  const [compressed, spaced] = givenA.length < givenB.length ? [givenA, givenB] : [givenB, givenA];
  if (compressed.length !== 1) return false;
  return compressed[0] === spaced.map(token => token[0]).join('');
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
 * boosted to at least 0.9, since scoring the whole string would rate "T M
 * Krishna" against "Thodur Madabusi Krishna" low despite being one person.
 *
 * Scoring is token-wise, never whole-string. Whole-string edit distance
 * dilutes a disagreement by the length of the agreement, so the same
 * one-character difference decides differently depending on how long the rest
 * of the name happens to be — "Sriram Parthasarathy" against "Sriran
 * Parthasarathy" scores 0.95 that way, because the shared surname drowns the
 * given name out. Comparing token against token keeps each difference scored
 * on its own length.
 */
export function artistNameSimilarity(a: string, b: string): number {
  const ta = tokensOf(a);
  const tb = tokensOf(b);

  if (ta.length === 0 || tb.length === 0) return 0;
  if (ta.join(' ') === tb.join(' ')) return 1;

  const givenA = ta.slice(0, -1);
  const givenB = tb.slice(0, -1);
  const surnameSimilarity = levenshteinSimilarity(ta[ta.length - 1], tb[tb.length - 1]);

  // The family name decides identity, so it must match outright. A spelling
  // variant here ("Raghunathan"/"Ragunathan") is indistinguishable from a
  // different person ("Kanyakumari"/"Kanyakumar") — same edit distance, same
  // token length — so both are rejected rather than guessed at.
  if (ta[ta.length - 1] !== tb[tb.length - 1]) {
    return Math.min(surnameSimilarity, DIFFERING_SURNAME_CAP);
  }

  if (givenA.length !== givenB.length) {
    return compressedInitialsMatch(givenA, givenB)
      ? 0.9
      : Math.min(levenshteinSimilarity(givenA.join(' '), givenB.join(' ')), DIFFERING_SURNAME_CAP);
  }

  for (let i = 0; i < givenA.length; i++) {
    if (tokenMatches(givenA[i], givenB[i])) continue;
    return givenA[i].length === 1 && givenB[i].length === 1
      ? DIFFERING_INITIAL_CAP
      : Math.min(levenshteinSimilarity(givenA[i], givenB[i]), DIFFERING_SURNAME_CAP);
  }

  return Math.max(levenshteinSimilarity(givenA.join(' '), givenB.join(' ')), 0.9);
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

/**
 * Every artist, for matching against.
 *
 * SCALING LIMIT, and it bites sooner than the page count suggests. The only
 * caller is the event-verify bulk import, which resolves artists inside a
 * sequential loop over events — so this runs once per *distinct new name in
 * the batch*, not once per import. Twenty events with five new names each is
 * up to a hundred full sweeps in one Lambda invocation.
 *
 * The cheap fix needs no new infrastructure: `findArtistMatch` is pure and
 * takes its candidates, so a caller processing a batch should call this once
 * and pass the list down. `findOrCreateArtist` is the convenience path for
 * one-off resolution.
 *
 * The real fix needs a new indexed attribute. It cannot be a prefix query on
 * `byName`, which is keyed on the raw stored name — matching works on the
 * normalized form, so nothing normalized can be looked up there.
 */
export async function listAllArtistsForMatching(): Promise<Artist[]> {
  const artists: Artist[] = [];
  let nextToken: string | undefined;

  do {
    const page = await listArtists({ limit: 200, nextToken });
    artists.push(...page.items);
    nextToken = page.nextToken;
  } while (nextToken);

  return artists;
}

/**
 * Find-or-create wrapper: try an exact `getArtistByName` lookup first
 * (cheap), then fall back to fuzzy matching against all existing artists,
 * and only create a new record when nothing matches.
 *
 * `title` is used only when creating; a matched record keeps its own.
 */
export async function findOrCreateArtist(
  name: string,
  opts?: { threshold?: number; title?: string; candidates?: Artist[] }
): Promise<{ artist: Artist; created: boolean }> {
  if (normalizeArtistName(name) === '') {
    throw new Error('Cannot resolve an artist from an empty name');
  }

  const exact = await getArtistByName(name);
  if (exact) {
    return { artist: exact, created: false };
  }

  const candidates = opts?.candidates ?? (await listAllArtistsForMatching());
  const match = findArtistMatch(name, candidates, opts?.threshold ?? DEFAULT_THRESHOLD);
  if (match) {
    return { artist: match, created: false };
  }

  const created = await createArtist({ name, title: opts?.title, gurus: [] });
  return { artist: created, created: true };
}
