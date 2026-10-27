/**
 * Swara notation for the raga page: phrases (prayogas), swara sets (jiva, nyasa, graha, anya)
 * and the twelve positions a scale occupies.
 *
 * Browser-safe and pure. Notation is never transliterated: these letters collide with ITRANS
 * consonant codes (see `formatSwaras`), so nothing here goes near `fromItrans`.
 *
 * The phrase grammar is wider than a scale's. A phrase may start on any note, need not touch
 * S, and carries octave and length marks:
 *
 *   N2.   lower octave (a dot after the token, as SSP's dot below the letter)
 *   S'    upper octave
 *   G2:2  held for two aksharas
 *   ,  ;  a pause of one or two aksharas
 */

/** Semitones above S for each named position. R2/G1 and R3/G2, D2/N1 and D3/N2 share a pitch. */
export const SWARA_SEMITONES: Readonly<Record<string, number>> = {
  S: 0,
  R1: 1,
  R2: 2,
  R3: 3,
  G1: 2,
  G2: 3,
  G3: 4,
  M1: 5,
  M2: 6,
  P: 7,
  D1: 8,
  D2: 9,
  D3: 10,
  N1: 9,
  N2: 10,
  N3: 11,
};

/** A swara with its variant, or a bare letter still to be read from the raga's scale. */
const SWARA = /^(S|P|R[123]?|G[123]?|M[12]?|D[123]?|N[123]?)$/;
const PHRASE_TOKEN = /^(S|P|R[123]?|G[123]?|M[12]?|D[123]?|N[123]?)(\.|')?(:[1-4])?$/;
const PAUSE = /^[,;]$/;

export interface NotationCheck {
  ok: boolean;
  value?: string;
  reason?: string;
}

/**
 * A prayoga, normalised to single-spaced tokens. Refuses prose and transliterated text, the
 * same way `validateSwaras` does for a scale, because a phrase that reads as notation but is
 * not is worse than no phrase.
 */
export function validatePhrase(raw: string): NotationCheck {
  const text = String(raw ?? '').trim();
  if (!text) return { ok: false, reason: 'empty' };
  if (text.length > 200) return { ok: false, reason: 'longer than 200 characters' };

  // Pauses written against a note ("G2," or "S;") are split off so each is a token.
  const tokens = text
    .replace(/([,;])/g, ' $1 ')
    .split(/\s+/)
    .filter(Boolean)
    .map(t => t.toUpperCase());
  const notes = tokens.filter(t => !PAUSE.test(t));
  if (notes.length < 2) return { ok: false, reason: 'fewer than two notes; not a phrase' };

  const bad = tokens.filter(t => !PAUSE.test(t) && !PHRASE_TOKEN.test(t));
  if (bad.length > 0) {
    return { ok: false, reason: `not swara notation: ${bad.slice(0, 3).join(' ')}` };
  }
  return { ok: true, value: tokens.join(' ') };
}

/** A swara set (jiva, nyasa, graha, anya): distinct tokens, octave marks dropped. */
export function parseSwaraSet(raw: string | string[]): NotationCheck & { tokens?: string[] } {
  const parts = (Array.isArray(raw) ? raw : String(raw ?? '').split(/[\s,|]+/))
    .map(t => t.trim().toUpperCase().replace(/['.]/g, ''))
    .filter(Boolean);
  if (parts.length === 0) return { ok: false, reason: 'empty' };
  const bad = parts.filter(t => !SWARA.test(t));
  if (bad.length > 0) {
    return { ok: false, reason: `not swara notation: ${bad.slice(0, 3).join(' ')}` };
  }
  const tokens = [...new Set(parts)];
  return { ok: true, value: tokens.join(' '), tokens };
}

/** The named tokens of a scale line, octave marks dropped. `S R2 G2 M1 P D2 N2 S'` → 7 tokens. */
export function scaleTokens(scale: string | null | undefined): string[] {
  return [
    ...new Set(
      String(scale ?? '')
        .toUpperCase()
        .split(/\s+/)
        .map(t => t.replace(/['`.,]/g, ''))
        .filter(t => t in SWARA_SEMITONES)
    ),
  ];
}

/**
 * The variant a bare letter takes in this raga. SSP names jiva swaras by letter only ("ri, ga,
 * ma and ni"), and the variant is the one the raga's own scale uses. Returns the bare letter
 * when the scale uses none or more than one variant of it, since guessing would mark the wrong
 * key on the strip.
 */
export function resolveVariant(token: string, scale: string[]): string {
  if (token in SWARA_SEMITONES) return token;
  const matches = [...new Set(scale.filter(t => t.startsWith(token)))];
  return matches.length === 1 ? (matches[0] as string) : token;
}

/** Every token of a swara set appears in the raga's scale or among its borrowed notes. */
export function swarasOutsideRaga(set: string[], scale: string[], anya: string[] = []): string[] {
  const allowed = new Set([...scale, ...anya]);
  const letters = new Set([...allowed].map(t => t[0]));
  return set.filter(t => (t in SWARA_SEMITONES ? !allowed.has(t) : !letters.has(t)));
}

export interface ScalePositions {
  /** Semitones used going up, 0–11. */
  up: number[];
  /** Semitones used coming down, 0–11. */
  down: number[];
  /** The name each used semitone carries in this scale, for labelling the strip. */
  names: Record<number, string>;
}

/** What the twelve-position strip draws. */
export function scalePositions(
  arohanam: string | null | undefined,
  avarohanam: string | null | undefined
): ScalePositions {
  const names: Record<number, string> = {};
  const read = (line: string | null | undefined) =>
    [
      ...new Set(
        scaleTokens(line).map(t => {
          const semitone = SWARA_SEMITONES[t] as number;
          names[semitone] = t;
          return semitone;
        })
      ),
    ].sort((a, b) => a - b);
  return { up: read(arohanam), down: read(avarohanam), names };
}
