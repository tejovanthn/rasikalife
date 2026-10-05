/**
 * Lyrics arrived in karnatik.com's romanisation, which is close to ITRANS but is not it, and
 * every page renders them through `fromItrans` with the `itrans_dravidian` scheme. Where the
 * two disagree the reader in another script sees the wrong letter: `hrdaya` became ह्र्दय,
 * `mangaLam` became மந்களம், and every Tamil `n` became ந, so என்னை read எந்நை.
 *
 * This module is the mechanical half of the repair, and the check for the other half.
 *
 * - `normalizeLyricsText` applies only the rules that hold in every language this corpus
 *   holds. It cannot fix a typo, a ர that should be ற, or a word the source misspelled; the
 *   source does not follow its own scheme consistently, so a per-composition check pass does
 *   that afterwards.
 * - `checkRespelling` is what makes that pass safe to accept unread in bulk. It refuses any
 *   line whose *words* changed rather than only their spelling, so the pass can correct
 *   letters and cannot rewrite lyrics.
 *
 * Browser-safe and free of I/O, so it is unit-tested here rather than in `packages/scripts`.
 */

/** Consonant letters as this corpus uses them. `R` is excluded: in the source it is Tamil ற. */
const CONSONANT = 'bcdfghjklmnpstvyBDGHJKLNPSTY';
/** `y` and `v` excluded: `dAridrya` and `tryambaka` are real r-clusters, not ṛ. */
const AFTER_VOCALIC_R = 'bcdfghjklmnpstBDGHJKLNPST';
const VOWEL = /[aeiouAEIOU]/;

const TAMIL_MARKER = /zh|[a-zA-Z]R|\b\w+(ai|um|il|aL|ukku|inil|EnE|iDam)\b/g;

/**
 * Share of words carrying a feature only Tamil has: ழ, ற, and its commonest endings.
 *
 * The stored `language` cannot be trusted for this. Of 5,449 compositions labelled Tamil,
 * about 2,000 score near zero — Annamacharya in Telugu, Swati Tirunal in Sanskrit — while
 * Telugu, Sanskrit and Kannada lyrics almost never reach 5%. The label looks like a default.
 */
export function tamilScore(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  if (words === 0) return 0;
  return (text.match(TAMIL_MARKER)?.length ?? 0) / words;
}

/** Above this the text is Tamil whatever its label says; the measured gap is 5%–10%. */
export const TAMIL_SCORE_THRESHOLD = 0.1;

export function looksTamil(text: string): boolean {
  return tamilScore(text) >= TAMIL_SCORE_THRESHOLD;
}

/** A token with no vowel is swara notation (`snsr`, `rpg`) or a stray initial, never a word. */
function isWord(token: string): boolean {
  return VOWEL.test(token);
}

function normalizeWord(word: string, opts: { tamil: boolean; sanskrit: boolean }): string {
  if (!isWord(word)) return word;
  let w = word;

  // Vocalic ṛ. A bare r between two consonants cannot be the consonant r in any of these
  // languages, so `hrdaya`, `krpA` and `drSTi` are ṛ. Also `r.` (`kr.shna`), and a word
  // opening on r plus a consonant (`rSi`, `rtu`).
  w = w.replace(new RegExp(`(?<=[${CONSONANT}])r\\.`, 'g'), 'R^i');
  w = w.replace(new RegExp(`(?<=[${CONSONANT}])r(?=[${AFTER_VOCALIC_R}])`, 'g'), 'R^i');
  w = w.replace(new RegExp(`^r(?=[${AFTER_VOCALIC_R}])`), 'R^i');

  w = fixJnaa(w);

  // A nasal before a velar is ṅ and before a palatal is ñ, in every language here:
  // `mangaLam`, `shankara`, `nenjam`, `panca`.
  w = w.replace(/(?<![~N])n(?=[kg])/g, '~N');
  w = w.replace(/(?<![~N])n(?=[cj])/g, '~n');

  // Sanskrit and Hindi have no short e or o, and in `itrans_dravidian` a bare `e` is the
  // short Dravidian vowel. `ee`/`oo` are someone's long vowel, so they become I/U first.
  if (opts.sanskrit) {
    w = w.replace(/ee/g, 'I').replace(/oo/g, 'U');
    w = w.replace(/(?<!a)e/g, 'E').replace(/(?<!a)o/g, 'O');
  }

  // Tamil writes ந only at the start of a word and before த; every other n is ன, which is
  // `n2` here. Gated on the text, not the label — see `tamilScore`.
  if (opts.tamil) {
    w = w.replace(/(?<=[A-Za-z'])n(?![2tdh~])/g, 'n2');
  }
  return w;
}

/**
 * `jn` is ज्ञ in every language here, and ITRANS spells it `j~n`. Added after the first packets
 * were cut, when the Tamil ன rule was found turning `jnAnam` into `jn2Anam`; exported so the
 * ingest can bring those packets' text up to the current rules before comparing.
 */
export function fixJnaa(text: string): string {
  return text.replace(/jn2?/g, 'j~n');
}

/**
 * `RRi` reads as vocalic ṛ, but this corpus never writes ṛ that way — it is a reader's ற்றி
 * (`paRRi`), which renders as ரு unless the two R's are kept apart with ITRANS's `_`.
 */
export function fixTamilRRi(text: string): string {
  return text.replace(/RR(?=[iI])/g, 'R_R');
}

const SANSKRIT_LIKE = /^(sanskrit|sankrit|hindi)/i;

export interface NormalizeOptions {
  /** The stored label. Used only for the Sanskrit vowel rule, where the label is reliable. */
  language?: string;
  /** Override the text-based Tamil decision, e.g. with the language a check pass returned. */
  tamil?: boolean;
}

export function normalizeLyricsText(text: string, opts: NormalizeOptions = {}): string {
  const sanskrit = SANSKRIT_LIKE.test(opts.language ?? '');
  const tamil = opts.tamil ?? (!sanskrit && looksTamil(text));
  return text
    .split('\n')
    .map(line =>
      isProtectedLine(line)
        ? line
        : line.replace(/\S+/g, word => normalizeWord(word, { tamil, sanskrit }))
    )
    .join('\n');
}

export interface LyricLine {
  type: string;
  order: number;
  text: string;
  number?: number;
  ragaName?: string;
}

/**
 * Normalise a whole composition. Tamil is decided once over all its sections, so a short
 * Tamil charanam is not left with ந because it happens to hold few markers on its own.
 */
export function normalizeLyrics<T extends LyricLine>(lyrics: T[], language?: string): T[] {
  const all = lyrics.map(l => l.text).join('\n');
  const sanskrit = SANSKRIT_LIKE.test(language ?? '');
  const tamil = !sanskrit && looksTamil(all);
  return lyrics.map(l => ({ ...l, text: normalizeLyricsText(l.text, { language, tamil }) }));
}

/**
 * What survives any respelling: case folded (so `R`/`r`, `N`/`n`, `D`/`d` meet), ITRANS
 * punctuation and digits dropped, every `h` dropped (aspiration, `sh`, `zh`, `ch`), repeated
 * letters collapsed (long vowels, geminates), and spaces and hyphens removed so a word that
 * was split or joined still compares.
 */
export function lyricsSkeleton(text: string): string {
  return (
    text
      .replace(/R\^i|R\^I/g, 'r')
      .toLowerCase()
      // The looser second spelling the corpus also holds: `moortee`, `gowri`, `sheivAi`.
      .replace(/ow/g, 'au')
      .replace(/ee/g, 'i')
      .replace(/oo/g, 'u')
      .replace(/([ae])y(?![aeiou])/g, '$1i')
      // ज्ञ is typed five ways: `jn`, `j~n`, `gn`, `gny`, `ny`.
      .replace(/~/g, '')
      .replace(/gny|jny|jn|gn|ny/g, 'n')
      // Tamil ற்ற arrives as `Tr` and leaves as `RR`.
      .replace(/tr/g, 'r')
      .replace(/[^a-z]/g, '')
      .replace(/h/g, '')
      .replace(/w/g, 'v')
      .replace(/z/g, 'l')
      .replace(/(.)\1+/g, '$1')
  );
}

function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  let prevPrev: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        (prev[j] ?? 0) + 1,
        (cur[j - 1] ?? 0) + 1,
        (prev[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      // Two adjacent letters swapped (`kapla` → `kalpa`) is one typo, not two.
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        cur[j] = Math.min(cur[j] ?? 0, (prevPrev[j - 2] ?? 0) + 1);
      }
    }
    prevPrev = prev;
    prev = cur;
  }
  return prev[b.length] ?? 0;
}

/**
 * How far one word's skeleton may move. A quarter of a *line* was tried first and let 42% of
 * single-word swaps through on long lines, because a whole word fits inside it — so the
 * budget is per word, and a short word gets one letter.
 */
function wordTolerance(skeleton: string): number {
  return Math.max(1, Math.floor(skeleton.length * 0.3));
}

/**
 * Align two word lists so that every word is matched to a respelling of itself, allowing two
 * words to be joined into one or one split into two (`caraNAm bhOja` → `caraNAmbhOja`).
 * Returns the total distance of the cheapest such alignment, or undefined when none exists.
 */
function alignWords(a: string[], b: string[]): number | undefined {
  const INF = Number.POSITIVE_INFINITY;
  const cost: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(INF)
  );
  const row = (i: number) => cost[i] as number[];
  row(0)[0] = 0;
  const step = (i: number, j: number, x: string, y: string, ni: number, nj: number) => {
    const d = editDistance(x, y);
    if (d > wordTolerance(x)) return;
    const next = (row(i)[j] as number) + d;
    if (next < (row(ni)[nj] as number)) row(ni)[nj] = next;
  };
  for (let i = 0; i <= a.length; i++) {
    for (let j = 0; j <= b.length; j++) {
      if (row(i)[j] === INF) continue;
      const ai = a[i];
      const bj = b[j];
      if (ai !== undefined && bj !== undefined) step(i, j, ai, bj, i + 1, j + 1);
      const ai2 = a[i + 1];
      const bj2 = b[j + 1];
      if (ai !== undefined && ai2 !== undefined && bj !== undefined)
        step(i, j, ai + ai2, bj, i + 2, j + 1);
      if (ai !== undefined && bj !== undefined && bj2 !== undefined)
        step(i, j, ai, bj + bj2, i + 1, j + 2);
    }
  }
  const total = row(a.length)[b.length] as number;
  return total === INF ? undefined : total;
}

function skeletonWords(line: string): string[] {
  return line
    .split(/[\s-]+/)
    .map(lyricsSkeleton)
    .filter(Boolean);
}

/** And no more than a tenth across a whole section, so many small swaps cannot add up. */
const SECTION_TOLERANCE = 0.1;

export type RespellingVerdict = { ok: true } | { ok: false; reason: string };

/**
 * Is `after` the same lyric as `before`, respelled? Lines must match one for one, a swara
 * line must come back untouched, and every word must align with a respelling of itself.
 */
export function checkRespelling(before: string, after: string): RespellingVerdict {
  const a = before.split('\n');
  const b = after.split('\n');
  if (a.length !== b.length) {
    return { ok: false, reason: `line count changed (${a.length} → ${b.length})` };
  }
  let total = 0;
  let changed = 0;
  for (let i = 0; i < a.length; i++) {
    const was = a[i] ?? '';
    const now = b[i] ?? '';
    if (isSwaraLine(was)) {
      if (was !== now)
        return { ok: false, reason: `line ${i + 1} is swara notation and was changed` };
      continue;
    }
    const x = skeletonWords(was);
    const d = alignWords(x, skeletonWords(now));
    if (d === undefined) {
      return {
        ok: false,
        reason: `line ${i + 1} changed words, not spelling: "${was}" → "${now}"`,
      };
    }
    total += x.join('').length;
    changed += d;
  }
  if (total > 0 && changed > Math.max(2, total * SECTION_TOLERANCE)) {
    return { ok: false, reason: `${changed} of ${total} letters changed across the section` };
  }
  return { ok: true };
}

const SWARA_TOKEN = /^[*,;.]*(s|r|g|m|p|d|n|sa|ri|ga|ma|pa|da|dha|ni)[0-9*,;.]*$/i;

/** A line most of whose tokens are swaras: `ga ga pa ga ri sa ri ri ga`, `S R2 G3 M1`. */
export function isSwaraLine(line: string): boolean {
  const tokens = line
    .trim()
    .split(/\s+/)
    .filter(t => t && !/^[,;.]+$/.test(t));
  if (tokens.length < 4) return false;
  return tokens.filter(t => SWARA_TOKEN.test(t)).length / tokens.length >= 0.8;
}

const ENGLISH_WORD =
  /\b(the|and|of|is|with|who|you|your|this|that|for|are|was|his|her|when|which|from|thrice|line|sing|meaning)\b/g;

/**
 * A line of English: a translation, a gist, a performance note. 96 such lines sit inside 26
 * compositions' lyrics, and the nasal rule turned "hungry" into `hu~Ngry`. The words are chosen
 * to collide with nothing in Hindi or Sanskrit — `to`, `me`, `in` and `hI` all would.
 */
export function isEnglishLine(line: string): boolean {
  const hits = line.match(ENGLISH_WORD)?.length ?? 0;
  return (
    hits >= 2 ||
    (hits >= 1 && line.trim().split(/\s+/).length <= 4 && /\b(the|and|of|is)\b/.test(line))
  );
}

/** A line no rule and no reader may change: swara notation or English. */
export function isProtectedLine(line: string): boolean {
  return isSwaraLine(line) || isEnglishLine(line);
}

/**
 * Put back every protected line of `original` into `text`, line for line. Repairs text that
 * went through an older rule set, and holds a reader to the same promise as the rules.
 */
export function restoreProtectedLines(original: string, text: string): string {
  const was = original.split('\n');
  const now = text.split('\n');
  if (was.length !== now.length) return text;
  return now.map((line, i) => (isProtectedLine(was[i] ?? '') ? (was[i] ?? line) : line)).join('\n');
}

/**
 * The languages a composition may be labelled with. The stored values also carry
 * `KannaDa`, `MalayaaLam`, `Sankrit` and a `Tamil` with a pallavi pasted after it.
 */
export const LYRICS_LANGUAGES = [
  'Tamil',
  'Telugu',
  'Kannada',
  'Sanskrit',
  'Malayalam',
  'Hindi',
  'Marathi',
  'Manipravalam',
] as const;
export type LyricsLanguage = (typeof LYRICS_LANGUAGES)[number];

export function canonicalLanguage(value: string): LyricsLanguage | undefined {
  const key =
    value
      .trim()
      .split(/\s/)[0]
      ?.toLowerCase()
      .replace(/[^a-z]/g, '') ?? '';
  const aliases: Record<string, LyricsLanguage> = {
    sankrit: 'Sanskrit',
    kannada: 'Kannada',
    malayaalam: 'Malayalam',
    manipravalam: 'Manipravalam',
  };
  return aliases[key] ?? LYRICS_LANGUAGES.find(l => l.toLowerCase() === key);
}

/**
 * A composition title with the scraped noise taken off. 290 titles carry the source's
 * "- Click to listen (performer)!" link text, which also landed in their URL slugs. A
 * bracketed qualifier — `(varNam)`, `(bhajan)`, `(jOnpuri)` — is kept: it is what tells two
 * pieces with the same opening words apart.
 */
export function cleanCompositionTitle(title: string): string {
  return title
    .replace(/\s+[-–]\s+click to lis(?:ten|etn)\b.*$/is, '')
    .replace(/!+\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** One correction from a reader: whole words, exactly as they stand in the text read. */
export interface WordFix {
  from: string;
  to: string;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Apply word fixes to a text. `from` must stand as whole whitespace-delimited words, so a fix
 * for `n2` cannot reach inside every Tamil word on the page; every occurrence is replaced.
 * Returns the fixes that matched nothing, so the caller can report them.
 */
export function applyWordFixes(
  text: string,
  fixes: WordFix[]
): { text: string; unmatched: WordFix[] } {
  let out = text;
  const unmatched: WordFix[] = [];
  for (const fix of fixes) {
    const from = fix.from.trim();
    if (!from) {
      unmatched.push(fix);
      continue;
    }
    // Punctuation stuck to a word (`pOi,`) and a hyphen (`varap-pOi`) are boundaries too.
    // `.` is not: `.n` is ITRANS.
    const pattern = new RegExp(
      `(?<=^|[\\s,;!?()"|-])${escapeRegExp(from)}(?=[\\s,;!?()"|-]|$)`,
      'g'
    );
    if (!pattern.test(out)) {
      // A fix listed twice: the first replaced every occurrence, so `to` is already there.
      const done = new RegExp(
        `(?<=^|[\\s,;!?()"|-])${escapeRegExp(fix.to.trim())}(?=[\\s,;!?()"|-]|$)`
      );
      if (!done.test(out)) unmatched.push(fix);
      continue;
    }
    out = out.replace(pattern, fix.to.trim());
  }
  return { text: out, unmatched };
}

/**
 * Move text between Tamil and not-Tamil after a reader corrected the language: `n2` is
 * Tamil-only, so it is removed, or the Tamil n rule is run over text that never had it.
 */
export function retargetTamil(text: string, tamil: boolean): string {
  return tamil ? normalizeLyricsText(text, { tamil: true }) : text.replace(/n2/g, 'n');
}
