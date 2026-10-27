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

import { z } from 'zod';
import { SourceSlugSchema } from '../source/schema';

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

export const CitationSchema = z.object({
  field: z.enum(CITABLE_RAGA_FIELDS),
  sourceSlug: SourceSlugSchema,
  /** Where in the source: a page ("pp. 375–376") or a URL. */
  locator: z.string().min(1).max(300),
  /** rasika-books' extraction confidence, 0–1. */
  confidence: z.number().min(0).max(1).optional(),
  /** Whose reading this is, where schools differ ("Dikshitar school"). */
  tradition: z.string().max(100).optional(),
  note: z.string().max(300).optional(),
});

export type Citation = z.infer<typeof CitationSchema>;

/**
 * A citation as read back from the table, where `field` is any string. Writes are checked
 * against `CitationSchema`; reads accept the stored shape and match on the field name.
 */
export interface StoredCitation {
  field: string;
  sourceSlug: string;
  locator: string;
  confidence?: number;
  tradition?: string;
  note?: string;
}

interface Cited {
  citations?: StoredCitation[] | null;
}

export function citationsFor(raga: Cited, field: CitableRagaField): StoredCitation[] {
  return (raga.citations ?? []).filter(c => c.field === field);
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

/** A field with nothing to show, for deciding where the request for help goes. */
export function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

export interface Reference {
  /** 1-based, in the order the page first cites it. */
  number: number;
  sourceSlug: string;
  locator: string;
  tradition?: string;
}

/**
 * Numbered references, one per distinct (source, locator) pair, in the order `fields` lists
 * them, which is the order the page shows them. Returns the list and each field's footnote
 * numbers.
 */
export function numberReferences(
  raga: Cited,
  fields: readonly CitableRagaField[]
): { references: Reference[]; footnotes: Partial<Record<CitableRagaField, number[]>> } {
  const references: Reference[] = [];
  const byKey = new Map<string, number>();
  const footnotes: Partial<Record<CitableRagaField, number[]>> = {};

  for (const field of fields) {
    const numbers: number[] = [];
    for (const c of citationsFor(raga, field)) {
      const key = `${c.sourceSlug}\u0000${c.locator}`;
      let n = byKey.get(key);
      if (n === undefined) {
        n = references.length + 1;
        byKey.set(key, n);
        references.push({
          number: n,
          sourceSlug: c.sourceSlug,
          locator: c.locator,
          tradition: c.tradition,
        });
      }
      if (!numbers.includes(n)) numbers.push(n);
    }
    if (numbers.length > 0) footnotes[field] = numbers;
  }
  return { references, footnotes };
}

/**
 * Keeps citations whose field still holds a value. A citation for a blank field claims
 * nothing, so clearing a field takes its citations with it.
 */
export function pruneCitations<C extends StoredCitation>(
  raga: { citations?: C[] | null } & Record<string, unknown>
): C[] {
  return (raga.citations ?? []).filter(c => !isEmptyValue(raga[c.field]));
}
