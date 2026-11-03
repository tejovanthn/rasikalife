/**
 * What the raga page shows, decided from the record. Pure, so the rules are tested here rather
 * than inside the route component, which vitest cannot render.
 *
 * The record arrives already passed through `shownRaga`, so every field present here is either
 * cited or a legacy field (see `sourced.ts`). This module only arranges it.
 */

import {
  type CitableRagaField,
  type Reference,
  type StoredCitation,
  numberReferences,
  resolveVariant,
  scaleTokens,
} from '@rasika/core/domain/raga/client';
import type { RagaHelpSection } from './help-request';

/** Page order, top to bottom. Footnotes are numbered in this order. */
export const RAGA_PAGE_FIELDS: readonly CitableRagaField[] = [
  'parentRaga',
  'isBhashanga',
  'scaleType',
  'arohanam',
  'avarohanam',
  'alternateScales',
  'anyaSwaras',
  'slokas',
  'description',
  'prayogas',
  'jivaSwaras',
  'nyasaSwaras',
  'grahaSwaras',
  'movement',
  'keyCompositionIds',
  'rasa',
  'timeOfDay',
  'season',
];

export interface RagaPageInput {
  arohanam?: string | null;
  avarohanam?: string | null;
  prayogas?: Array<{ notation: string; label?: string }> | null;
  slokas?: Array<{ text: string; author?: string }> | null;
  alternateScales?: string[] | null;
  jivaSwaras?: string[] | null;
  nyasaSwaras?: string[] | null;
  grahaSwaras?: string[] | null;
  anyaSwaras?: string[] | null;
  movement?: string | null;
  keyCompositionIds?: string[] | null;
  rasa?: string | null;
  timeOfDay?: string | null;
  season?: string | null;
  citations?: StoredCitation[] | null;
}

export interface RagaPageModel {
  hasMovement: boolean;
  hasLearnFrom: boolean;
  hasCharacter: boolean;
  /** The one section that carries the request for help, or none when all three hold data. */
  helpSection?: RagaHelpSection;
  /** Swara sets with bare letters resolved to this raga's own variants. */
  swaras: { jiva: string[]; nyasa: string[]; graha: string[]; anya: string[] };
  references: Reference[];
  footnotes: Partial<Record<CitableRagaField, number[]>>;
  /**
   * Alternate scales, each with the footnotes of the citations whose `note` is that entry.
   * `footnotes.alternateScales` then holds only the citations that name no entry.
   */
  alternateScales: AlternateScaleRow[];
  /** The tradition a field's citation names, for "Evening, in the Dikshitar school". */
  traditionOf: Partial<Record<CitableRagaField, string>>;
}

export interface AlternateScaleRow {
  scale: string;
  /** Footnotes for this entry alone. Empty when no citation names it. */
  numbers: number[];
  tradition?: string;
}

const nonEmpty = (list: unknown[] | null | undefined) => (list?.length ?? 0) > 0;

export function ragaPageModel(raga: RagaPageInput): RagaPageModel {
  const scale = scaleTokens(`${raga.arohanam ?? ''} ${raga.avarohanam ?? ''}`);
  const resolve = (set: string[] | null | undefined) =>
    (set ?? []).map(token => resolveVariant(token, scale));

  const hasMovement =
    nonEmpty(raga.prayogas) ||
    nonEmpty(raga.jivaSwaras) ||
    nonEmpty(raga.nyasaSwaras) ||
    nonEmpty(raga.grahaSwaras) ||
    !!raga.movement?.trim();
  const hasLearnFrom = nonEmpty(raga.keyCompositionIds);
  const hasCharacter = !!(raga.rasa?.trim() || raga.timeOfDay?.trim() || raga.season?.trim());

  // One request per page, at the first empty section in page order: a bare page should not
  // read as a column of the same box.
  const empty: Array<[RagaHelpSection, boolean]> = [
    ['movement', hasMovement],
    ['learn', hasLearnFrom],
    ['character', hasCharacter],
  ];
  const helpSection = empty.find(([, has]) => !has)?.[0];

  // Named inline only when every citation for the field agrees. Where two traditions read it
  // differently, each is printed against its own footnote in the references.
  const traditionOf: Partial<Record<CitableRagaField, string>> = {};
  for (const field of RAGA_PAGE_FIELDS) {
    const traditions = new Set(
      (raga.citations ?? []).filter(c => c.field === field && c.tradition).map(c => c.tradition)
    );
    const only = traditions.size === 1 ? [...traditions][0] : undefined;
    if (only) traditionOf[field] = only;
  }

  const numbered = numberReferences({ citations: raga.citations ?? [] }, RAGA_PAGE_FIELDS);
  // A citation whose note equals one entry marks that entry alone. One that matches none keeps
  // the field-level footnote, as before.
  const entries = raga.alternateScales ?? [];
  const altCitations = (raga.citations ?? []).filter(c => c.field === 'alternateScales');
  const matches = (c: StoredCitation, scale: string) => c.note?.trim() === scale.trim();
  const alternateScales: AlternateScaleRow[] = entries.map(scale => {
    const own = altCitations.filter(c => matches(c, scale));
    const numbers = [
      ...new Set(own.map(c => numbered.numberOf(c)).filter((n): n is number => !!n)),
    ];
    return { scale, numbers, tradition: own.find(c => c.tradition)?.tradition };
  });
  const fieldLevel = altCitations.filter(c => !entries.some(scale => matches(c, scale)));
  const { alternateScales: _own, ...otherFootnotes } = numbered.footnotes;
  const fieldNumbers = [
    ...new Set(fieldLevel.map(c => numbered.numberOf(c)).filter((n): n is number => !!n)),
  ];
  const footnotes: RagaPageModel['footnotes'] =
    fieldNumbers.length > 0 ? { ...otherFootnotes, alternateScales: fieldNumbers } : otherFootnotes;

  return {
    hasMovement,
    hasLearnFrom,
    hasCharacter,
    helpSection,
    swaras: {
      jiva: resolve(raga.jivaSwaras),
      nyasa: resolve(raga.nyasaSwaras),
      graha: resolve(raga.grahaSwaras),
      anya: resolve(raga.anyaSwaras),
    },
    references: numbered.references,
    footnotes,
    alternateScales,
    traditionOf,
  };
}
