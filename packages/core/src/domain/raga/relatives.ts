/**
 * Ragas whose scales are one or two notes away from this one's.
 *
 * Computed, never researched: two stored scales either differ or they do not. Each relative's
 * own page carries the citations for its scale, so this claims nothing beyond "these two
 * stored scales differ in these notes". Browser-safe and pure; the search service runs it over
 * the index it already holds.
 */

import { SWARA_SEMITONES, scaleTokens } from './notation';

export interface ScaleOf {
  id: string;
  name: string;
  arohanam?: string | null;
  avarohanam?: string | null;
  /** Ranks ties: search volume for ragas. */
  popularity?: number;
}

export interface NoteChange {
  /** 'both' when the same change holds going up and coming down. */
  direction: 'up' | 'down' | 'both';
  /** The note this raga uses, absent when the relative adds one this raga omits. */
  from?: string;
  /** The note the relative uses, absent when the relative omits it. */
  to?: string;
}

export interface Relative {
  id: string;
  name: string;
  changes: NoteChange[];
}

/** At most this many note changes, counting a change made both ways once. */
const MAX_CHANGES = 2;

type Line = Map<string, string>; // swara letter → token, e.g. G → G2

function line(scale: string | null | undefined): Line | undefined {
  const tokens = scaleTokens(scale);
  if (tokens.length < 4) return undefined;
  const byLetter = new Map<string, string>();
  for (const t of tokens) {
    const letter = t[0] as string;
    // Two variants of one letter in a line (a vakra or bhashanga scale) do not compare as a
    // simple substitution, so such a line takes no part.
    if (byLetter.has(letter) && byLetter.get(letter) !== t) return undefined;
    byLetter.set(letter, t);
  }
  return byLetter;
}

function lineChanges(a: Line, b: Line): Array<{ from?: string; to?: string }> {
  const changes: Array<{ from?: string; to?: string }> = [];
  for (const letter of ['S', 'R', 'G', 'M', 'P', 'D', 'N']) {
    const from = a.get(letter);
    const to = b.get(letter);
    if (from === to) continue;
    // R2 and G1 are one pitch: a scale written either way is the same scale.
    if (from && to && SWARA_SEMITONES[from] === SWARA_SEMITONES[to]) continue;
    changes.push({ from, to });
  }
  return changes;
}

const key = (c: { from?: string; to?: string }) => `${c.from ?? ''}>${c.to ?? ''}`;

/** How `other` differs from `self`, or undefined when either scale cannot be compared. */
export function noteChanges(self: ScaleOf, other: ScaleOf): NoteChange[] | undefined {
  const [sUp, sDown, oUp, oDown] = [
    line(self.arohanam),
    line(self.avarohanam),
    line(other.arohanam),
    line(other.avarohanam),
  ];
  if (!sUp || !sDown || !oUp || !oDown) return undefined;

  const up = lineChanges(sUp, oUp);
  const down = lineChanges(sDown, oDown);
  const downKeys = new Set(down.map(key));
  const upKeys = new Set(up.map(key));

  return [
    ...up.map(c => ({ ...c, direction: downKeys.has(key(c)) ? 'both' : 'up' }) as NoteChange),
    ...down.filter(c => !upKeys.has(key(c))).map(c => ({ ...c, direction: 'down' }) as NoteChange),
  ];
}

/**
 * The closest scales, nearest first, then by popularity, then by name. A raga with the same
 * notes both ways is listed too (zero changes): it differs only in how it moves, which is
 * worth a reader knowing.
 */
export function findRelatives(self: ScaleOf, corpus: ScaleOf[], limit = 6): Relative[] {
  const found: Array<Relative & { popularity: number }> = [];
  for (const other of corpus) {
    if (other.id === self.id) continue;
    const changes = noteChanges(self, other);
    if (!changes || changes.length > MAX_CHANGES) continue;
    found.push({
      id: other.id,
      name: other.name,
      changes,
      popularity: other.popularity ?? 0,
    });
  }
  return found
    .sort(
      (a, b) =>
        a.changes.length - b.changes.length ||
        b.popularity - a.popularity ||
        a.name.localeCompare(b.name)
    )
    .slice(0, limit)
    .map(({ popularity: _, ...r }) => r);
}

/** "uses G3 instead of G2 going up", for the page. */
export function describeChange(c: NoteChange): string {
  const where = c.direction === 'both' ? '' : c.direction === 'up' ? ' going up' : ' coming down';
  if (c.from && c.to) return `uses ${c.to} instead of ${c.from}${where}`;
  if (c.to) return `adds ${c.to}${where}`;
  return `leaves out ${c.from}${where}`;
}
