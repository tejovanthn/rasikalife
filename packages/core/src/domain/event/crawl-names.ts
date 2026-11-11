/**
 * Name keys for the event crawl: artists, and the venue words shared with crawl.ts.
 * Pure. The keys are for MATCHING only. A record keeps the spelling a person would print
 * (initials and all); see `pickDisplayName`.
 *
 * Why not reuse `artistNameSimilarity` alone: it rejects "Delhi Sunder Rajan" against
 * "Delhi P. Sunder Rajan" (different token counts) and cannot tell "V.Deepika" from
 * "V. Deepika". This module adds a key that ignores initials, titles, spacing and common
 * transliteration variants, and says which of those it relied on.
 */

const HONORIFICS = new Set([
  'dr',
  'prof',
  'professor',
  'sri',
  'shri',
  'sree',
  'smt',
  'srimati',
  'srimathi',
  'tmt',
  'thiru',
  'selvi',
  'kum',
  'kumari',
  'ms',
  'mr',
  'mrs',
  'vid',
  'vidwan',
  'vidvan',
  'mahavidwan',
  'vidushi',
  'pandit',
  'pt',
  'ustad',
  'guru',
  'master',
  'late',
]);

export interface ArtistKey {
  /** Lowercase letters only, titles and initials removed, single spaces. Not transliterated. */
  key: string;
  /** `key` with common spelling variants folded (th/t, dh/d, sh/s, aa/a, ee/i, oo/u, doubles). */
  folded: string;
  /** Single-letter initials, in order ("V. Deepika" -> ["v"]). */
  initials: string[];
  hasInitials: boolean;
  tokens: string[];
}

const keyCache = new Map<string, ArtistKey>();

const FOLDS: Array<[RegExp, string]> = [
  [/sh/g, 's'],
  [/th/g, 't'],
  [/dh/g, 'd'],
  [/kh/g, 'k'],
  [/gh/g, 'g'],
  [/bh/g, 'b'],
  [/ph/g, 'p'],
  [/aa/g, 'a'],
  [/ee/g, 'i'],
  [/ii/g, 'i'],
  [/oo/g, 'u'],
  [/uu/g, 'u'],
  [/w/g, 'v'],
  [/(.)\1+/g, '$1'],
];

/** Folds one word. Applied to the family name only for an automatic match; see `compare`. */
export function foldToken(token: string): string {
  let out = token;
  for (const [pattern, to] of FOLDS) out = out.replace(pattern, to);
  return out;
}

const stripMarks = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '');

export function artistKey(raw: string): ArtistKey {
  const hit = keyCache.get(raw);
  if (hit) return hit;
  // Split on dots first so "V.Deepika" and "P.Sunderrajan" give an initial and a word.
  const words = stripMarks(raw)
    .replace(/[.,/()_-]+/g, ' ')
    .replace(/[^\p{L}\s']/gu, ' ')
    .replace(/'/g, '')
    .split(/\s+/)
    .filter(Boolean);
  // "TM Krishna": two or three capitals with no vowel are initials run together.
  const expanded = words.flatMap(w =>
    /^[A-Z]{2,3}$/.test(w) && !/[AEIOU]/.test(w) && !HONORIFICS.has(w.toLowerCase())
      ? w.split('')
      : [w]
  );
  let tokens = expanded.map(w => w.toLowerCase());
  // Leading titles, possibly stacked. "U. Ve." (Upanyasam title) is two tokens.
  let start = 0;
  while (start < tokens.length - 1) {
    if (HONORIFICS.has(tokens[start])) start++;
    else if (tokens[start] === 'u' && tokens[start + 1] === 've') start += 2;
    else break;
  }
  tokens = tokens.slice(start);
  const initials = tokens.filter(t => t.length === 1);
  let rest = tokens.filter(t => t.length > 1);
  // A name that is only initials keeps them, so it can still be compared.
  if (!rest.length) rest = tokens;
  const key = rest.join(' ');
  const result: ArtistKey = {
    key,
    folded: rest.map(foldToken).join(' '),
    initials: rest === tokens ? [] : initials,
    hasInitials: rest !== tokens && initials.length > 0,
    tokens: rest,
  };
  keyCache.set(raw, result);
  return result;
}

const compact = (s: string) => s.replace(/\s+/g, '');

// ---------------------------------------------------------------------------
// String distance

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = curr;
  }
  return prev[b.length];
}

export function jaroWinkler(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  const range = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const am = new Array<boolean>(a.length).fill(false);
  const bm = new Array<boolean>(b.length).fill(false);
  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    const lo = Math.max(0, i - range);
    const hi = Math.min(b.length - 1, i + range);
    for (let j = lo; j <= hi; j++) {
      if (bm[j] || a[i] !== b[j]) continue;
      am[i] = bm[j] = true;
      matches++;
      break;
    }
  }
  if (!matches) return 0;
  let t = 0;
  let k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!am[i]) continue;
    while (!bm[k]) k++;
    if (a[i] !== b[k]) t++;
    k++;
  }
  const jaro = (matches / a.length + matches / b.length + (matches - t / 2) / matches) / 3;
  let prefix = 0;
  while (prefix < 4 && a[prefix] === b[prefix]) prefix++;
  return jaro + prefix * 0.1 * (1 - jaro);
}

// ---------------------------------------------------------------------------
// Comparing two names

export type NameTier = 'exact' | 'close' | 'none';

export interface NameComparison {
  tier: NameTier;
  /** 0-1, for ranking. */
  score: number;
  reason:
    | 'same-key'
    | 'initials-ignored'
    | 'spelling-variant'
    | 'spelling-variant-surname'
    | 'bare-given-name'
    | 'fuzzy'
    | 'initials-differ'
    | 'different';
}

export const FUZZY_JARO_WINKLER = 0.93;

const none = (reason: NameComparison['reason'] = 'different'): NameComparison => ({
  tier: 'none',
  score: 0,
  reason,
});

function initialsConflict(a: string[], b: string[]): boolean {
  if (!a.length || !b.length) return false;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return true;
  return false;
}

/**
 * Two names for one person?
 *
 * - `exact`: the keys match once titles, initials, spaces and punctuation are removed, and the
 *   initials agree or one side has none ("Delhi Sunder Rajan" ~ "Delhi P. Sunder Rajan"). Given
 *   names may differ in spelling variants (th/t ...); the family name (last word) must match as
 *   typed, as in `artistNameSimilarity`, since "Muralidharan"/"Muralidaran" cannot be told from
 *   two people.
 * - `close`: for a person to confirm, never merged on its own. A family-name spelling variant,
 *   one letter apart, Jaro-Winkler >= 0.93, or a bare given name against an initialled one
 *   ("Deepika" ~ "V. Deepika") because many people share a given name.
 * - Two different initials ("K. Deepika", "V. Deepika") are two people: `none`.
 */
export function compareArtistNames(a: string, b: string): NameComparison {
  const ka = artistKey(a);
  const kb = artistKey(b);
  if (!ka.key || !kb.key) return none();
  if (initialsConflict(ka.initials, kb.initials)) return none('initials-differ');

  const sameInitials =
    ka.initials.length === kb.initials.length && ka.initials.every((x, i) => x === kb.initials[i]);
  const multiWord = ka.tokens.length > 1 && kb.tokens.length > 1;

  if (compact(ka.key) === compact(kb.key)) {
    if (sameInitials) return { tier: 'exact', score: 1, reason: 'same-key' };
    if (multiWord) return { tier: 'exact', score: 0.98, reason: 'initials-ignored' };
    return { tier: 'close', score: 0.95, reason: 'bare-given-name' };
  }

  if (compact(ka.folded) === compact(kb.folded)) {
    const sameFamily = ka.tokens.at(-1) === kb.tokens.at(-1);
    if (sameFamily && multiWord) {
      return { tier: 'exact', score: 0.96, reason: 'spelling-variant' };
    }
    return { tier: 'close', score: 0.94, reason: 'spelling-variant-surname' };
  }

  const jw = jaroWinkler(compact(ka.folded), compact(kb.folded));
  const near = levenshtein(compact(ka.key), compact(kb.key)) <= 1 && compact(ka.key).length >= 6;
  if (near || jw >= FUZZY_JARO_WINKLER) {
    return { tier: 'close', score: Math.max(jw, near ? 0.93 : 0), reason: 'fuzzy' };
  }
  return none();
}

// ---------------------------------------------------------------------------
// Display and clusters

/** Prefer initials, then more words, then no title, then longer. "V. Deepika" over "Deepika". */
export function pickDisplayName(names: string[]): string {
  const score = (n: string) => {
    const k = artistKey(n);
    const titled = /^\s*(dr|prof|sri|shri|smt|vidwan|vidushi|kum|ms|mr|pandit|u\.?\s*ve)\b/i.test(
      n
    );
    const shouting = n === n.toUpperCase() && /[A-Z]/.test(n);
    return [k.initials.length, k.tokens.length, titled ? 0 : 1, shouting ? 0 : 1, n.length];
  };
  return [...names].sort((x, y) => {
    const sx = score(x);
    const sy = score(y);
    for (let i = 0; i < sx.length; i++) if (sx[i] !== sy[i]) return sy[i] - sx[i];
    return x.localeCompare(y);
  })[0];
}

export interface NameCluster {
  /** The spelling to store: the fullest, with initials. */
  display: string;
  /** Every spelling seen, display first. */
  variants: string[];
}

export interface ClusterResult {
  clusters: NameCluster[];
  /** Pairs held for a person to confirm, not merged. */
  close: Array<{ a: string; b: string; reason: NameComparison['reason'] }>;
  /** Any spelling -> the cluster's display name. */
  displayOf: Map<string, string>;
}

/**
 * One cluster per person across the crawl. Joins only `exact` pairs, plus a bare given name that
 * has exactly one initialled spelling ("Deepika" -> "V. Deepika"; not when "K. Deepika" is also
 * there). `close` pairs are returned for review.
 */
export function clusterArtistNames(rawNames: string[]): ClusterResult {
  const names = [...new Set(rawNames.map(n => n.trim()).filter(n => artistKey(n).key))];
  const parent = names.map((_, i) => i);
  const find = (i: number): number => {
    let x = i;
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  const union = (i: number, j: number) => {
    const a = find(i);
    const b = find(j);
    if (a !== b) parent[b] = a;
  };

  const close: ClusterResult['close'] = [];
  const bare: Array<[number, number]> = [];
  // Cheap guard against n*n on a long list: only compare names that share a first letter in
  // either key. A leading difference past that is not a spelling variant.
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const cmp = compareArtistNames(names[i], names[j]);
      if (cmp.tier === 'exact') union(i, j);
      else if (cmp.tier === 'close') {
        if (cmp.reason === 'bare-given-name') bare.push([i, j]);
        else close.push({ a: names[i], b: names[j], reason: cmp.reason });
      }
    }
  }
  // A bare given name joins an initialled one only if exactly one initialled person has it.
  const bareIndexes = new Set(bare.map(([i, j]) => (artistKey(names[i]).hasInitials ? j : i)));
  for (const b of bareIndexes) {
    const partners = bare
      .map(([i, j]) => (i === b ? j : j === b ? i : -1))
      .filter(x => x >= 0 && artistKey(names[x]).hasInitials);
    const people = new Set(partners.map(find));
    if (people.size === 1) union(b, partners[0]);
    else
      for (const p of partners) close.push({ a: names[b], b: names[p], reason: 'bare-given-name' });
  }

  const groups = new Map<number, string[]>();
  names.forEach((n, i) => {
    const root = find(i);
    groups.set(root, [...(groups.get(root) ?? []), n]);
  });
  const clusters: NameCluster[] = [];
  const displayOf = new Map<string, string>();
  for (const members of groups.values()) {
    const display = pickDisplayName(members);
    clusters.push({ display, variants: [display, ...members.filter(m => m !== display)] });
    for (const m of members) displayOf.set(m, display);
  }
  for (const raw of rawNames) {
    const display = displayOf.get(raw.trim());
    if (display) displayOf.set(raw, display);
  }
  return { clusters, close, displayOf };
}
