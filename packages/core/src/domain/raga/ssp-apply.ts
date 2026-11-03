/**
 * The decisions behind `ssp-apply` and `ssp-undo`, pure so they can be tested.
 *
 * Apply: take the patch `buildSspRagaPatch` made against the stored raga as it stands, merge
 * the new citations onto the stored ones (never dropping one), and record each field's value
 * before and after. Undo: put a field back only while it still holds what the import wrote, and
 * remove exactly the citations the import added.
 *
 * Browser-safe and pure.
 */

import { UpdateRagaSchema } from './schema';
import { type StoredCitation, isEmptyValue, pruneCitations } from './sourced';
import type { SspCitation, SspHeld, SspResult, SspStoredRaga } from './ssp';

// ── citations ─────────────────────────────────────────────────────────────────────────────

/** Two citations are one when field, source, locator, tradition and note agree. */
export function citationKey(c: StoredCitation): string {
  return [c.field, c.sourceSlug, c.locator, c.tradition ?? '', c.note ?? ''].join('\u0001');
}

export function mergeCitations<C extends StoredCitation>(
  stored: readonly C[] | null | undefined,
  incoming: readonly C[]
): { merged: C[]; added: C[] } {
  const merged = [...(stored ?? [])];
  const seen = new Set(merged.map(citationKey));
  const added: C[] = [];
  for (const c of incoming) {
    const key = citationKey(c);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(c);
    added.push(c);
  }
  return { merged, added };
}

// ── comparing values ──────────────────────────────────────────────────────────────────────

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined && v !== null)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

export function sameValue(a: unknown, b: unknown): boolean {
  if (isEmptyValue(a) && isEmptyValue(b)) return true;
  return canonical(a) === canonical(b);
}

// ── apply ─────────────────────────────────────────────────────────────────────────────────

export interface FieldChange {
  /** `null` when the field was empty. */
  before: unknown;
  after: unknown;
}

export interface SspApplyPlan {
  changes: Record<string, FieldChange>;
  citationsAdded: SspCitation[];
  /** The payload for the raga update path: the patch fields plus the merged citation list. */
  update: Record<string, unknown>;
  held: SspHeld[];
  notes: string[];
  /** Set when the payload fails the raga schema. Nothing should be written. */
  error?: string;
}

export function planSspApply(
  result: SspResult,
  stored: SspStoredRaga & Record<string, unknown>
): SspApplyPlan {
  const changes: Record<string, FieldChange> = {};
  const update: Record<string, unknown> = {};
  for (const [field, after] of Object.entries(result.patch)) {
    if (isEmptyValue(after)) continue;
    const before = stored[field];
    if (sameValue(before, after)) continue;
    changes[field] = { before: isEmptyValue(before) ? null : before, after };
    update[field] = after;
  }

  const { merged, added } = mergeCitations(
    stored.citations as StoredCitation[] | null | undefined,
    result.citations as StoredCitation[]
  );
  if (added.length > 0) update.citations = merged;

  const plan: SspApplyPlan = {
    changes,
    citationsAdded: added as SspCitation[],
    update,
    held: result.held,
    notes: result.notes,
  };
  if (Object.keys(update).length > 0) {
    const parsed = UpdateRagaSchema.safeParse(update);
    if (!parsed.success) {
      plan.error = parsed.error.issues
        .map(i => `${i.path.join('.') || 'raga'}: ${i.message}`)
        .join('; ');
    }
  }
  return plan;
}

// ── manifest and undo ─────────────────────────────────────────────────────────────────────

export interface SspManifestEntry {
  ragaId: string;
  ragaName: string;
  sspId: string;
  section: string;
  volume: number;
  changes: Record<string, FieldChange>;
  citationsAdded: StoredCitation[];
  undoneAt?: string;
}

export interface SspUndoPlan {
  /** Values to write back. */
  set: Record<string, unknown>;
  /** Fields that were empty before: remove them (never `.set(undefined)`). */
  remove: string[];
  restored: string[];
  skipped: { field: string; reason: string }[];
  citationsRemoved: number;
}

export function planSspUndo(
  entry: Pick<SspManifestEntry, 'changes' | 'citationsAdded'>,
  current: Record<string, unknown> & { citations?: StoredCitation[] | null }
): SspUndoPlan {
  const set: Record<string, unknown> = {};
  const remove: string[] = [];
  const restored: string[] = [];
  const skipped: { field: string; reason: string }[] = [];

  for (const [field, { before, after }] of Object.entries(entry.changes)) {
    if (sameValue(current[field], before)) continue; // already back as it was
    if (!sameValue(current[field], after)) {
      skipped.push({ field, reason: 'changed since the import' });
      continue;
    }
    if (isEmptyValue(before)) remove.push(field);
    else set[field] = before;
    restored.push(field);
  }

  const drop = new Set(entry.citationsAdded.map(citationKey));
  const kept = (current.citations ?? []).filter(c => !drop.has(citationKey(c)));

  // A citation for a field left empty claims nothing, so it goes with the value.
  const after: Record<string, unknown> = { ...current, ...set, citations: kept };
  for (const field of remove) after[field] = undefined;
  const nextCitations = pruneCitations(after as { citations?: StoredCitation[] | null });
  const hadCitations = (current.citations ?? []).length > 0;
  if (nextCitations.length > 0) {
    if (nextCitations.length !== (current.citations ?? []).length) set.citations = nextCitations;
  } else if (hadCitations) {
    remove.push('citations');
  }

  return {
    set,
    remove,
    restored,
    skipped,
    citationsRemoved: (current.citations ?? []).length - nextCitations.length,
  };
}
