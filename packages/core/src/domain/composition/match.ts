// Matching an outside archive's compositions (shivkumar.org) against ours. Pure, so it
// can be tested; the `shivkumar-match` CLI feeds it the database and writes a review CSV.
//
// The two sides spell differently: our titles are karnatik.com's near-ITRANS
// (`Muttuswaamee Dikshitar`, `tODi`, `kEdAragauLa`), the archive's are plain English
// (`Dikshitar`, `Thodi`, `Kedaragowla`). `foldKey` and `looseKey` fold the usual differences, and an
// edit-distance check catches the rest. Like raga dedup, nothing here decides on its own:
// it suggests, and a person writes the decision.

import { ragaExactKey } from '../raga/dedup';

/**
 * Folds the common romanisation differences: long vowels written doubled, aspirate `h`,
 * `y` glides, c/k, w/v, zh/l, au/ow/ou. Lossy on purpose; it finds candidates, it does
 * not decide.
 */
export function foldKey(name: string): string {
  let key = ragaExactKey(name).replace(/[0-9]/g, '');
  key = key.replace(/ee/g, 'i').replace(/oo/g, 'u');
  key = key.replace(/au|ou|ow/g, 'o');
  key = key.replace(/[hy]/g, '');
  key = key.replace(/w/g, 'v').replace(/[cq]/g, 'k').replace(/z/g, 'l').replace(/x/g, 'ks');
  return key.replace(/(.)\1+/g, '$1');
}

/**
 * `foldKey` for a whole name, with the ending dropped too: `hindOLa`/`hindolam`,
 * `kEdAra`/`kedaram`, `gauLa`/`gowlai`, `Sri Ragam`/`shrI`. Not for titles, where the
 * ending is often what makes a prefix long enough to trust.
 */
export function looseKey(name: string): string {
  return foldKey(name.replace(/\s*raga(m)?\s*$/i, '')).replace(/(am|m|ai|a)$/, '');
}

export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row.push(Math.min((prev[j] ?? 0) + 1, (row[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + cost));
    }
    prev = row;
  }
  return prev[b.length] ?? 0;
}

/** Same name once folded, or a letter apart (two on a long name): `durbar`/`darbAr`. */
export function namesAgree(a: string, b: string): boolean {
  const ka = looseKey(a);
  const kb = looseKey(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  const longest = Math.max(ka.length, kb.length);
  return longest >= 5 && editDistance(ka, kb) <= Math.max(1, Math.floor(longest / 6));
}

/**
 * Does a raga name agree with one of ours? Also allows a qualifier on our side,
 * e.g. `dhIra shankarAbharaNam` for `Shankarabharanam`.
 */
export function ragaAgrees(theirs: string, ours: string): boolean {
  if (namesAgree(theirs, ours)) return true;
  const kt = looseKey(theirs);
  const ko = looseKey(ours);
  return kt.length >= 5 && ko.length >= 5 && (ko.endsWith(kt) || kt.endsWith(ko));
}

/** Short forms as the archive writes them: "Dikshitar" for "Muttuswaamee Dikshitar". */
export function composerAgrees(theirs: string, ours: string): boolean {
  if (namesAgree(theirs, ours)) return true;
  const words = (name: string) =>
    name
      .split(/[\s.]+/)
      .map(foldKey)
      .filter(word => word.length >= 4);
  const ourWords = words(ours);
  const theirWords = words(theirs);
  if (theirWords.length === 0 || ourWords.length === 0) return false;
  // Every long word on the shorter side must appear (near enough) on the longer one.
  const [short, long] =
    theirWords.length <= ourWords.length ? [theirWords, ourWords] : [ourWords, theirWords];
  return short.every(word =>
    long.some(other => other === word || (word.length >= 5 && editDistance(word, other) <= 1))
  );
}

/** The archive's tala names, to the tala names our records already use. */
const TALA_NAMES: Array<[RegExp, string]> = [
  [/chapu|capu/i, 'cApu'],
  [/desadi|deshadi/i, 'dEshaadi'],
  [/madhyadi/i, 'madhyaadi'],
  [/\badi\b|^adi/i, 'Adi'],
  [/rupak/i, 'rUpaka'],
  [/\bata\b/i, 'aTa'],
  [/jhampa/i, 'jhampa'],
  [/triputa/i, 'tripuTa'],
  [/dhruva/i, 'dhruva'],
  [/matya|matya/i, 'maTya'],
  [/\beka/i, 'Eka'],
];

export function canonicalTala(name?: string): string | undefined {
  if (!name) return undefined;
  return TALA_NAMES.find(([pattern]) => pattern.test(name))?.[1];
}

/**
 * The best of our names for one of theirs. A name with the same key wins over a looser
 * agreement, however much more the looser one is used: `Varali` is `varALi`, not the far
 * commoner `punnAgavarALi` it is a suffix of.
 */
export function resolveName(
  theirs: string | undefined,
  ours: ReadonlyArray<{ name: string; uses: number }>,
  agrees: (theirs: string, ours: string) => boolean
): string | undefined {
  if (!theirs) return undefined;
  const mostUsed = (list: ReadonlyArray<{ name: string; uses: number }>) =>
    list.reduce<{ name: string; uses: number } | undefined>(
      (best, candidate) => (!best || candidate.uses > best.uses ? candidate : best),
      undefined
    )?.name;
  const key = looseKey(theirs);
  return (
    mostUsed(ours.filter(candidate => looseKey(candidate.name) === key)) ??
    mostUsed(ours.filter(candidate => agrees(theirs, candidate.name)))
  );
}

export interface OurComposition {
  id: string;
  title: string;
  composer: string;
  ragas: string[];
  /** How much the record holds (lyrics length, say): breaks a tie between our own copies. */
  weight?: number;
}

export interface TheirComposition {
  title: string;
  raga?: string;
  composer?: string;
}

export type MatchSuggestion = 'attach' | 'create' | 'review';

export interface MatchOptions {
  /**
   * Whether their raga is one of ours. Defaults to comparing names; the CLI also compares
   * scales, since one raga carries several names (`Panthuvarali` is `kAmavardhani`).
   */
  ragaAgrees?: (theirs: string, ours: string) => boolean;
}

export interface MatchResult {
  suggestion: MatchSuggestion;
  confidence: 'high' | 'medium' | 'low';
  match?: OurComposition;
  /** Other records that also fit, for the reviewer. */
  others: OurComposition[];
  reason: string;
}

/** A title on one side that begins the other: "Abhayambikaya" and "abhayAmbikAyAH anyam". */
function titlesAgree(theirs: string, ours: string): 'same' | 'prefix' | false {
  if (namesAgree(theirs, ours)) return 'same';
  const kt = foldKey(theirs);
  const ko = foldKey(ours);
  const [short, long] = kt.length <= ko.length ? [kt, ko] : [ko, kt];
  if (short.length >= 7 && long.startsWith(short)) return 'prefix';
  if (short.length >= 9 && editDistance(short, long.slice(0, short.length)) <= 1) return 'prefix';
  return false;
}

/**
 * Finds the record of ours that is the same composition.
 *
 * - `attach`/high: title agrees, and the raga and composer agree.
 * - `attach`/medium: title and raga agree; one side has no composer.
 * - `review`/medium: title and raga agree; the composers differ.
 * - `review`/low: the title agrees but the raga does not, or several records fit equally.
 * - `create`: no record of ours has this title.
 */
export function matchComposition(
  theirs: TheirComposition,
  ours: ReadonlyArray<OurComposition>,
  options: MatchOptions = {}
): MatchResult {
  const sameRaga = options.ragaAgrees ?? ragaAgrees;
  const scored = ours
    .map(candidate => {
      const title = titlesAgree(theirs.title, candidate.title);
      if (!title) return null;
      const raga =
        theirs.raga && candidate.ragas.length > 0
          ? candidate.ragas.some(name => sameRaga(theirs.raga ?? '', name))
          : undefined;
      const composer =
        theirs.composer && candidate.composer
          ? composerAgrees(theirs.composer, candidate.composer)
          : undefined;
      const score =
        (title === 'same' ? 2 : 1) + (raga ? 4 : raga === false ? -4 : 0) + (composer ? 2 : 0);
      return { candidate, title, raga, composer, score };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => b.score - a.score || (b.candidate.weight ?? 0) - (a.candidate.weight ?? 0));

  const best = scored[0];
  if (!best) {
    return { suggestion: 'create', confidence: 'high', others: [], reason: 'no title match' };
  }
  const others = scored.slice(1, 4).map(row => row.candidate);
  const tiedRows = scored.filter(row => row.score === best.score);
  // Our corpus holds some songs twice. When every tied record is the same title in the
  // same raga, they are copies of one song: take the fullest, which sorts first.
  const ourCopies =
    tiedRows.length > 1 &&
    best.raga === true &&
    tiedRows.every(
      row =>
        titlesAgree(row.candidate.title, best.candidate.title) &&
        row.candidate.ragas.some(name =>
          best.candidate.ragas.some(other => namesAgree(name, other))
        )
    );
  const tied = tiedRows.length > 1 && !ourCopies;
  const what = [
    `title ${best.title}`,
    best.raga === undefined ? 'raga unknown' : best.raga ? 'raga agrees' : 'raga differs',
    best.composer === undefined
      ? 'composer unknown'
      : best.composer
        ? 'composer agrees'
        : 'composer differs',
  ].join(', ');

  if (best.raga === false) {
    return { suggestion: 'review', confidence: 'low', match: best.candidate, others, reason: what };
  }
  if (tied) {
    return {
      suggestion: 'review',
      confidence: 'low',
      match: best.candidate,
      others,
      reason: `${what}; ${scored.filter(row => row.score === best.score).length} records fit equally`,
    };
  }
  if (ourCopies) {
    return {
      suggestion: 'attach',
      confidence: 'medium',
      match: best.candidate,
      others,
      reason: `${what}; we hold ${tiedRows.length} copies, the fullest chosen`,
    };
  }
  if (best.raga && best.composer) {
    return {
      suggestion: 'attach',
      confidence: 'high',
      match: best.candidate,
      others,
      reason: what,
    };
  }
  if (best.raga && best.composer === undefined) {
    return {
      suggestion: 'attach',
      confidence: 'medium',
      match: best.candidate,
      others,
      reason: what,
    };
  }
  if (best.raga) {
    // Title and raga agree but the composer does not: often one side's error, sometimes
    // a different song (two composers set the same opening words in the same raga).
    return {
      suggestion: 'review',
      confidence: 'medium',
      match: best.candidate,
      others,
      reason: what,
    };
  }
  return { suggestion: 'review', confidence: 'low', match: best.candidate, others, reason: what };
}
