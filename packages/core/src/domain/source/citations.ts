/**
 * Citation code shared by every entity that cites a source (ragas, artists).
 *
 * An entity supplies its own list of citable fields. The rules for reading a citation, numbering
 * references and pruning them are the same for all, so they live here once. What an entity
 * does with an uncited field (hide it, or show it as legacy) stays in that entity's own
 * `sourced.ts`.
 *
 * Browser-safe and pure.
 */

import { z } from 'zod';
import { SourceSlugSchema } from './schema';

/** The citation schema for an entity whose citable fields are `fields`. */
export function citationSchemaFor<const F extends readonly [string, ...string[]]>(fields: F) {
  return z.object({
    field: z.enum(fields),
    sourceSlug: SourceSlugSchema,
    /** Where in the source: a page ("pp. 375–376") or a URL. */
    locator: z.string().min(1).max(300),
    /** rasika-books' extraction confidence, 0–1. */
    confidence: z.number().min(0).max(1).optional(),
    /** Whose reading this is, where schools differ ("Dikshitar school"). */
    tradition: z.string().max(100).optional(),
    note: z.string().max(300).optional(),
  });
}

/**
 * A citation as read back from the table, where `field` is any string. Writes are checked
 * against the entity's schema; reads accept the stored shape and match on the field name.
 */
export interface StoredCitation {
  field: string;
  sourceSlug: string;
  locator: string;
  confidence?: number;
  tradition?: string;
  note?: string;
}

export interface Cited {
  citations?: StoredCitation[] | null;
}

export function citationsOf<F extends string>(record: Cited, field: F): StoredCitation[] {
  return (record.citations ?? []).filter(c => c.field === field);
}

/** A field with nothing to show. */
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
  /** What this citation says of the field, where it is not an entry marker. */
  note?: string;
}

/**
 * Fields whose citation `note` names the entry the citation marks, not a remark. Such a note
 * stays off the references list.
 */
export interface MarkerFields {
  markerFields?: ReadonlySet<string>;
}

function referenceNote(c: StoredCitation, markers?: ReadonlySet<string>): string | undefined {
  return markers?.has(c.field) ? undefined : c.note?.trim() || undefined;
}

/**
 * The key two citations share when they print as one reference: same source, place, tradition
 * and note. Two traditions on one page, or one field read two ways, must not collapse into
 * whichever came first.
 */
export function referenceKeyOf(c: StoredCitation, markers?: ReadonlySet<string>): string {
  return [c.sourceSlug, c.locator, c.tradition ?? '', referenceNote(c, markers) ?? ''].join(
    '\u0000'
  );
}

/**
 * Numbered references, one per distinct (source, locator, tradition, note), in the order
 * `fields` lists them, which is the order the page shows them. Returns the list and each
 * field's footnote numbers.
 */
export function numberReferencesOf<F extends string>(
  record: Cited,
  fields: readonly F[],
  markers?: ReadonlySet<string>
): {
  references: Reference[];
  footnotes: Partial<Record<F, number[]>>;
  /** The reference number a citation prints under. */
  numberOf: (c: StoredCitation) => number | undefined;
} {
  const references: Reference[] = [];
  const byKey = new Map<string, number>();
  const footnotes: Partial<Record<F, number[]>> = {};

  for (const field of fields) {
    const numbers: number[] = [];
    for (const c of citationsOf(record, field)) {
      const key = referenceKeyOf(c, markers);
      let n = byKey.get(key);
      if (n === undefined) {
        n = references.length + 1;
        byKey.set(key, n);
        references.push({
          number: n,
          sourceSlug: c.sourceSlug,
          locator: c.locator,
          tradition: c.tradition,
          note: referenceNote(c, markers),
        });
      }
      if (!numbers.includes(n)) numbers.push(n);
    }
    if (numbers.length > 0) footnotes[field] = numbers;
  }
  return { references, footnotes, numberOf: c => byKey.get(referenceKeyOf(c, markers)) };
}

/**
 * Keeps citations whose field still holds a value. A citation for a blank field claims
 * nothing, so clearing a field takes its citations with it.
 */
export function pruneCitationsOf<C extends StoredCitation>(
  record: { citations?: C[] | null } & Record<string, unknown>
): C[] {
  return (record.citations ?? []).filter(c => !isEmptyValue(record[c.field]));
}
