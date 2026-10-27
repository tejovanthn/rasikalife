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
  /** The tradition a field's citation names, for "Evening, in the Dikshitar school". */
  traditionOf: Partial<Record<CitableRagaField, string>>;
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

  const traditionOf: Partial<Record<CitableRagaField, string>> = {};
  for (const c of raga.citations ?? []) {
    const field = c.field as CitableRagaField;
    if (c.tradition && !traditionOf[field]) traditionOf[field] = c.tradition;
  }

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
    ...numberReferences({ citations: raga.citations ?? [] }, RAGA_PAGE_FIELDS),
    traditionOf,
  };
}
