/**
 * Matching SSP people to stored artists, for review.
 *
 * `findArtistMatch` needs the surname to match outright, so `Dīkṣita` never finds `Dikshitar`
 * and `Muttusvāmi` never finds `Muttuswaamee`. This matcher folds spelling the way
 * `composition/match.ts` does and ranks by how many compositions a stored record holds.
 *
 * Pure. It suggests; a person writes `decision`. Tiers:
 * - `exact`: the folded names are equal (`Muttusvāmi Dīkṣita` and `Muttuswaamee Dikshitar`).
 * - `close`: every distinctive word of the shorter name is in the longer one, and the lineage
 *   words (`Dīkṣita`, `Śāstri`, `Ayya`) do not contradict. `Muddusvāmi` finds Muttuswaamee.
 * - `loose`: one distinctive word in common. Shown for the reviewer, never attached.
 *
 * A lineage word is not a name. `Rāmasvāmi Dīkṣita` does not match `Muttuswaamee Dikshitar` on
 * `Dīkṣita`, and a stored record named only `Dikshitar` (a junk duplicate) is never a candidate.
 */

import { editDistance } from '../composition/match';
import {
  GENERIC_NAME_WORDS,
  type SspNameWord,
  type SspPerson,
  sspNameKey,
  sspNameWords,
} from './ssp-people';

export interface SspMatchArtist {
  id: string;
  name: string;
  alternateNames?: string[] | null;
  deletedAt?: string | null;
  mergedIntoId?: string | null;
}

export type SspPersonTier = 'exact' | 'close' | 'loose' | 'none';
export type SspPersonSuggestion = 'attach' | 'create' | 'review' | 'skip';

export interface SspCandidate {
  id: string;
  name: string;
  tier: Exclude<SspPersonTier, 'none'>;
  score: number;
  compositions: number;
  /** The pair of names that agreed, for a reviewer who cannot judge from an id. */
  matchedOn: string;
}

export interface SspPersonMatch {
  key: string;
  tier: SspPersonTier;
  candidates: SspCandidate[];
  flags: string[];
  suggestion: SspPersonSuggestion;
  /** Stored names left out as junk (a bare surname), when they would have matched. */
  junkExcluded: string[];
}

export const FLAG_MULTIPLE_EXACT = 'multiple-exact';
export const FLAG_MULTIPLE_CLOSE = 'multiple-close';
export const FLAG_DUPLICATE_TARGET = 'duplicate-target';
export const FLAG_QUALIFIED = 'qualified-name';
export const FLAG_JUNK_EXCLUDED = 'junk-excluded';
export const FLAG_LOOSE_ONLY = 'loose-only';
export const FLAG_PERSON_NOTES = 'join-notes';

/** A composer with this many compositions in Vols 1–4 is a major one. */
export const MAJOR_COMPOSER_COUNT = 15;

interface Words {
  all: SspNameWord[];
  core: SspNameWord[];
  generic: string[];
  light: string;
}

function wordsOf(name: string): Words {
  const all = sspNameWords(name).filter(w => w.fold.length >= 2);
  return {
    all,
    core: all.filter(w => !GENERIC_NAME_WORDS.has(w.fold)),
    generic: all.filter(w => GENERIC_NAME_WORDS.has(w.fold)).map(w => w.fold),
    light: all.map(w => w.light).join(''),
  };
}

/**
 * The same word, spelled differently. The fold is lossy (it drops `y` and `h`), so a word that
 * folds alike must also be close in its light form: `Nannayya` and `Nayana` fold alike and are
 * not one name.
 */
function sameWord(a: SspNameWord, b: SspNameWord): boolean {
  const longest = Math.max(a.light.length, b.light.length);
  const lightOk = editDistance(a.light, b.light) <= Math.max(1, Math.floor(longest / 5));
  if (a.fold === b.fold) return lightOk;
  if (Math.min(a.fold.length, b.fold.length) >= 6 && editDistance(a.fold, b.fold) <= 1 && lightOk) {
    return true;
  }
  // A case or honorific ending only: `Rāmadāsar` and `Raamadaas`.
  const stem = (w: string) => w.replace(/(ar|a|i|u|r|m)$/, '');
  const sa = stem(a.fold);
  const sb = stem(b.fold);
  return (
    Math.min(sa.length, sb.length) >= 5 &&
    sa === sb &&
    editDistance(stem(a.light), stem(b.light)) <= 1
  );
}

/** Only lineage words, or nothing: a record that names no one. */
function isJunkName(name: string): boolean {
  const w = wordsOf(name);
  return w.core.length === 0;
}

interface Pair {
  tier: Exclude<SspPersonTier, 'none'>;
  score: number;
}

function comparePair(a: Words, b: Words, keyA: string, keyB: string): Pair | undefined {
  if (a.core.length === 0 || b.core.length === 0) return undefined;
  if (keyA === keyB && a.all.every((w, i) => sameWord(w, b.all[i]))) {
    return { tier: 'exact', score: 100 };
  }

  // The same words run together or apart: `Purandara Daasar`, `Swaati TirunaaL`.
  const joinedA = a.all.map(w => w.fold).join('');
  const joinedB = b.all.map(w => w.fold).join('');
  if (joinedA.length >= 8 && joinedA === joinedB) return { tier: 'exact', score: 95 };
  const coreA = a.core.map(w => w.fold).join('');
  const coreB = b.core.map(w => w.fold).join('');
  const lineageOk =
    a.generic.length === 0 || b.generic.length === 0 || a.generic.some(g => b.generic.includes(g));
  if (coreA.length >= 8 && coreA === coreB && lineageOk) return { tier: 'close', score: 85 };

  // One name must hold the other: the SSP name may be the bare first name ("Muddusvāmi"), or
  // the stored one may add a place or a rank. Two names that each have a word the other lacks
  // ("Rāmasvāmi Dīkṣita", "Rāmasvāmi Śivan") are two people.
  const hold = (x: Words, y: Words) => x.all.every(w => y.all.some(o => sameWord(w, o)));
  const aInB = hold(a, b);
  const bInA = hold(b, a);
  const diff = Math.abs(a.all.length - b.all.length);
  // A stored name that is a lone word is too thin to say that a longer name is its owner.
  const thin = bInA && !aInB && b.all.length < 2;
  const lineageAgrees = a.generic.some(g => b.generic.includes(g));
  if ((aInB || bInA) && !thin) {
    return { tier: 'close', score: 70 + (lineageAgrees ? 10 : 0) - 3 * diff };
  }
  const shared = a.core.filter(w => w.fold.length >= 5 && b.core.some(o => sameWord(w, o))).length;
  if (shared > 0) return { tier: 'loose', score: 30 + 5 * shared - 3 * diff };
  return undefined;
}

const TIER_RANK = { exact: 0, close: 1, loose: 2 } as const;

export interface SspMatchOptions {
  /** Compositions held per stored artist id; ranks candidates and breaks ties. */
  compositionCounts?: ReadonlyMap<string, number>;
}

export function matchSspPerson(
  person: Pick<
    SspPerson,
    'key' | 'name' | 'iastName' | 'alternateNames' | 'composedCount' | 'qualifier' | 'notes'
  >,
  artists: readonly SspMatchArtist[],
  opts: SspMatchOptions = {}
): SspPersonMatch {
  const personNames = [...new Set([person.iastName, person.name, ...person.alternateNames])]
    // A one-word alternate ("Dīkṣita") is a lineage word, not a name to match on.
    .filter(n => wordsOf(n).core.length > 0)
    .map(n => ({ name: n, words: wordsOf(n), key: sspNameKey(n) }));

  const candidates: SspCandidate[] = [];
  const junkExcluded: string[] = [];

  for (const artist of artists) {
    if (artist.deletedAt || artist.mergedIntoId) continue;
    const stored = [artist.name, ...(artist.alternateNames ?? [])].map(n => ({
      name: n,
      words: wordsOf(n),
      key: sspNameKey(n),
    }));
    if (isJunkName(artist.name)) {
      // A bare "Dikshitar": name it in the report when it would have drawn this person in.
      const lineage = stored[0].words.generic;
      if (personNames.some(p => p.words.generic.some(g => lineage.includes(g)))) {
        junkExcluded.push(`${artist.id}:${artist.name}`);
      }
      continue;
    }
    let best: (Pair & { matchedOn: string }) | undefined;
    for (const p of personNames) {
      for (const s of stored) {
        const pair = comparePair(p.words, s.words, p.key, s.key);
        if (!pair) continue;
        const better =
          !best ||
          TIER_RANK[pair.tier] < TIER_RANK[best.tier] ||
          (pair.tier === best.tier && pair.score > best.score);
        if (better) best = { ...pair, matchedOn: `${p.name} ~ ${s.name}` };
      }
    }
    if (best) {
      candidates.push({
        id: artist.id,
        name: artist.name,
        tier: best.tier,
        score: best.score,
        compositions: opts.compositionCounts?.get(artist.id) ?? 0,
        matchedOn: best.matchedOn,
      });
    }
  }

  candidates.sort(
    (a, b) =>
      TIER_RANK[a.tier] - TIER_RANK[b.tier] ||
      b.score - a.score ||
      b.compositions - a.compositions ||
      a.name.localeCompare(b.name, 'en')
  );

  const tier: SspPersonTier = candidates[0]?.tier ?? 'none';
  const exact = candidates.filter(c => c.tier === 'exact');
  const close = candidates.filter(c => c.tier === 'close');

  const flags: string[] = [];
  if (exact.length > 1) flags.push(FLAG_MULTIPLE_EXACT);
  if (exact.length === 0 && close.length > 1) flags.push(FLAG_MULTIPLE_CLOSE);
  if (person.qualifier) flags.push(FLAG_QUALIFIED);
  if (junkExcluded.length > 0) flags.push(FLAG_JUNK_EXCLUDED);
  if (person.notes.length > 0) flags.push(FLAG_PERSON_NOTES);
  if (isDoubtfulName(person.iastName)) flags.push('doubtful-name');
  if (tier === 'loose') flags.push(FLAG_LOOSE_ONLY);

  return {
    key: person.key,
    tier,
    candidates,
    flags,
    suggestion: suggest(person, tier, exact.length, flags),
    junkExcluded,
  };
}

/**
 * A name that is abbreviated (`K. Jagannātha`), garbled (`Akkul. Svāmi`) or a family
 * designation (`Pollavaramuvāru`, "those of Pollavaram") is not safe to turn into a record.
 */
export function isDoubtfulName(iastName: string): boolean {
  const words = iastName.split(/\s+/);
  return words.some(
    w => /^\p{L}\.$/u.test(w) || /\p{L}\.$/u.test(w) || /¯|[0-9]/.test(w) || /vāru$/i.test(w)
  );
}

function suggest(
  person: Pick<SspPerson, 'composedCount' | 'iastName'>,
  tier: SspPersonTier,
  exactCount: number,
  flags: readonly string[]
): SspPersonSuggestion {
  const blocking = flags.filter(f => f !== FLAG_JUNK_EXCLUDED && f !== FLAG_PERSON_NOTES);
  if (tier === 'exact' && exactCount === 1 && blocking.length === 0) return 'attach';
  if (isDoubtfulName(person.iastName)) return 'review';
  if (tier === 'none') return person.composedCount > 0 ? 'create' : 'review';
  // A first name in common with an unrelated surname does not stand in the way of a major
  // composer, who has no record of their own. A lesser one is left for the reviewer.
  if (tier === 'loose' && person.composedCount >= MAJOR_COMPOSER_COUNT) return 'create';
  return 'review';
}

/**
 * Matches every person, then flags two people that point at one stored artist. Neither is
 * pre-filled `attach` then: one of them is the wrong man, and only a person can say which.
 */
export function matchSspPeople(
  people: readonly SspPerson[],
  artists: readonly SspMatchArtist[],
  opts: SspMatchOptions = {}
): SspPersonMatch[] {
  const rows = people.map(p => matchSspPerson(p, artists, opts));
  const targets = new Map<string, number>();
  for (const row of rows) {
    const top = row.candidates.filter(c => c.tier !== 'loose');
    for (const c of top) targets.set(c.id, (targets.get(c.id) ?? 0) + 1);
  }
  for (const row of rows) {
    const shared = row.candidates.some(c => c.tier !== 'loose' && (targets.get(c.id) ?? 0) > 1);
    if (!shared) continue;
    row.flags.push(FLAG_DUPLICATE_TARGET);
    if (row.suggestion === 'attach') row.suggestion = 'review';
  }
  return rows;
}
