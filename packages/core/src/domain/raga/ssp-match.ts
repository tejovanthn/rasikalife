/**
 * Matching SSP raga records to stored ragas, for review.
 *
 * Pure. One row per SSP record. Tiers:
 * - `exact`: `ragaExactKey` of the SSP name equals that of a stored name. The key strips marks,
 *   so `kānaḍā` meets `kAnaDA`, and `kannaḍa` (two n) does not.
 * - `variant`: only `ragaVariantKey` agrees. This tier guesses spelling and collides distinct
 *   ragas, so it is never `apply`.
 * - `none`: nothing agrees. A raga is never created from this.
 *
 * `suggestion` is `apply` only for an exact match with one candidate and no flag.
 */

import { ragaExactKey, ragaVariantKey } from './dedup';
import { type SspRagaRecord, sspMatchCheck } from './ssp';

export interface SspMatchInput {
  record: SspRagaRecord & { section_number?: string | null };
  volume: number;
}

export interface SspMatchStored {
  id: string;
  name: string;
  melaNumber?: number | null;
  deletedAt?: string | null;
  mergedIntoId?: string | null;
}

export interface SspMatchCandidate {
  id: string;
  name: string;
  melaNumber: number | null;
}

export type SspMatchTier = 'exact' | 'variant' | 'none';
export type SspSuggestion = 'apply' | 'review' | 'skip';

export interface SspMatchRow {
  /** The extraction's own id, which the apply step uses to find the record again. */
  sspId: string;
  section: string;
  sspName: string;
  volume: number;
  kind: string;
  tier: SspMatchTier;
  candidates: SspMatchCandidate[];
  flags: string[];
  suggestion: SspSuggestion;
}

export const FLAG_DUPLICATE_NAME = 'duplicate-name';
export const FLAG_DUPLICATE_TARGET = 'duplicate-target';
export const FLAG_MELA_MISMATCH = 'mela-mismatch';
export const FLAG_MULTIPLE_MATCHES = 'multiple-matches';
export const FLAG_JUNK_HEADING = 'junk-heading';

export function matchSspRagas(
  sspRecords: readonly SspMatchInput[],
  storedRagas: readonly SspMatchStored[]
): SspMatchRow[] {
  const live = storedRagas.filter(r => !r.deletedAt && !r.mergedIntoId);
  const byExact = new Map<string, SspMatchStored[]>();
  const byVariant = new Map<string, SspMatchStored[]>();
  for (const raga of live) {
    const ek = ragaExactKey(raga.name);
    if (ek) byExact.set(ek, [...(byExact.get(ek) ?? []), raga]);
    const vk = ragaVariantKey(raga.name);
    if (vk) byVariant.set(vk, [...(byVariant.get(vk) ?? []), raga]);
  }

  const nameCount = new Map<string, number>();
  for (const { record } of sspRecords) {
    nameCount.set(record.name_canonical, (nameCount.get(record.name_canonical) ?? 0) + 1);
  }
  const duplicateNames = new Set(
    [...nameCount].filter(([, count]) => count > 1).map(([name]) => name)
  );

  const rows = sspRecords.map(({ record, volume }): SspMatchRow => {
    const exact = byExact.get(ragaExactKey(record.name_canonical)) ?? [];
    const variant = (byVariant.get(ragaVariantKey(record.name_canonical)) ?? []).filter(
      r => !exact.includes(r)
    );
    const tier: SspMatchTier = exact.length ? 'exact' : variant.length ? 'variant' : 'none';
    const matched = tier === 'exact' ? exact : tier === 'variant' ? variant : [];
    const candidates = matched.map(r => ({
      id: r.id,
      name: r.name,
      melaNumber: r.melaNumber ?? null,
    }));

    const flags: string[] = [];
    let melaMismatch = false;
    for (const raga of matched) {
      const check = sspMatchCheck(record, raga, { duplicateNames });
      if (check.melaMismatch) melaMismatch = true;
      if (check.junkHeading && !flags.includes(FLAG_JUNK_HEADING)) flags.push(FLAG_JUNK_HEADING);
    }
    if (duplicateNames.has(record.name_canonical)) flags.push(FLAG_DUPLICATE_NAME);
    if (melaMismatch) flags.push(FLAG_MELA_MISMATCH);
    if (candidates.length > 1) flags.push(FLAG_MULTIPLE_MATCHES);

    return {
      sspId: record.merged_provisional_id,
      section: record.section_number ?? '',
      sspName: record.name_canonical,
      volume,
      kind: record.kind ?? '',
      tier,
      candidates,
      flags,
      suggestion: 'review',
    };
  });

  // Two SSP records on one stored raga: neither may write until a person picks.
  const targetCount = new Map<string, number>();
  for (const row of rows) {
    for (const c of row.candidates) targetCount.set(c.id, (targetCount.get(c.id) ?? 0) + 1);
  }
  for (const row of rows) {
    if (
      row.candidates.some(c => (targetCount.get(c.id) ?? 0) > 1) &&
      !row.flags.includes(FLAG_DUPLICATE_TARGET)
    ) {
      row.flags.push(FLAG_DUPLICATE_TARGET);
    }
    row.suggestion =
      row.tier === 'none'
        ? 'skip'
        : row.tier === 'exact' && row.candidates.length === 1 && row.flags.length === 0
          ? 'apply'
          : 'review';
  }
  return rows;
}
