/**
 * Which raga facts the site may show, and the references that back them.
 *
 * The rule (owner, 2026-10-27): **a fact renders only when it has a citation.** The page, the
 * meta description and the JSON-LD make the same claim, so all three read from `shownRaga`
 * rather than from the record.
 *
 * One exception, also the owner's: the fields that predate citations (`LEGACY_FIELDS`) stay
 * visible while uncited. The research workers that wrote them returned sources and the ingest
 * dropped them, so hiding them would empty some 1,200 pages that rank. They gain citations as
 * enrichment reaches them. Rasa, time of day and season are not among them: they are the
 * claims schools disagree on, and "Universal" for Bhairavi, against SSP's "evening", is why.
 *
 * Browser-safe and pure.
 */

import type { z } from 'zod';
import {
  type Reference,
  type StoredCitation,
  citationSchemaFor,
  citationsOf,
  isEmptyValue,
  numberReferencesOf,
  pruneCitationsOf,
  referenceKeyOf,
} from '../source/citations';

export { isEmptyValue };
export type { Reference, StoredCitation };

/** Every raga field a citation may back. */
export const CITABLE_RAGA_FIELDS = [
  'description',
  'arohanam',
  'avarohanam',
  'alternateScales',
  'parentRaga',
  'rasa',
  'timeOfDay',
  'season',
  'scaleType',
  'isBhashanga',
  'prayogas',
  'slokas',
  'jivaSwaras',
  'nyasaSwaras',
  'grahaSwaras',
  'anyaSwaras',
  'movement',
  'keyCompositionIds',
] as const;

export type CitableRagaField = (typeof CITABLE_RAGA_FIELDS)[number];

/** Shown while uncited, until a source confirms or replaces them. */
export const LEGACY_FIELDS: ReadonlySet<CitableRagaField> = new Set([
  'description',
  'arohanam',
  'avarohanam',
  'alternateScales',
  'parentRaga',
]);

export const CitationSchema = citationSchemaFor(CITABLE_RAGA_FIELDS);

export type Citation = z.infer<typeof CitationSchema>;

interface Cited {
  citations?: StoredCitation[] | null;
}

export function citationsFor(raga: Cited, field: CitableRagaField): StoredCitation[] {
  return citationsOf(raga, field);
}

export function isCited(raga: Cited, field: CitableRagaField): boolean {
  return citationsFor(raga, field).length > 0;
}

/** A field the page may show: cited, or a legacy field. */
export function isShown(raga: Cited, field: CitableRagaField): boolean {
  return LEGACY_FIELDS.has(field) || isCited(raga, field);
}

/**
 * The record with every field it may not show removed. Fields outside `CITABLE_RAGA_FIELDS`
 * (name, mela number, ids) pass through: the mela number is derived from the parent.
 */
export function shownRaga<T extends Cited>(raga: T): T {
  const out = { ...raga } as Record<string, unknown>;
  for (const field of CITABLE_RAGA_FIELDS) {
    if (!isShown(raga, field)) delete out[field];
  }
  return out as T;
}

/** The raga fields whose citation `note` names an entry, not a remark (see `raga-page.ts`). */
const ENTRY_MARKER_FIELDS: ReadonlySet<string> = new Set(['alternateScales']);

export function referenceKey(c: StoredCitation): string {
  return referenceKeyOf(c, ENTRY_MARKER_FIELDS);
}

/**
 * Numbered references, one per distinct (source, locator, tradition, note), in the order
 * `fields` lists them, which is the order the page shows them.
 */
export function numberReferences(raga: Cited, fields: readonly CitableRagaField[]) {
  return numberReferencesOf(raga, fields, ENTRY_MARKER_FIELDS);
}

/**
 * Keeps citations whose field still holds a value. A citation for a blank field claims
 * nothing, so clearing a field takes its citations with it.
 */
export function pruneCitations<C extends StoredCitation>(
  raga: { citations?: C[] | null } & Record<string, unknown>
): C[] {
  return pruneCitationsOf(raga);
}
