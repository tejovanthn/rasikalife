import type { RepertoireComposition, RepertoireRaga } from './client';

/**
 * The rows an artist's repertoire is aggregated from — one per setlist entry across
 * the events they performed in. Only the fields the counts need are required.
 */
export interface RepertoireSetlistRow {
  compositionId?: string;
  compositionTitle?: string;
  ragaId?: string;
  ragaName?: string;
}

export interface Repertoire {
  topCompositions: RepertoireComposition[];
  topRagas: RepertoireRaga[];
}

const TOP_N = 10;

/**
 * Aggregate an artist's "most performed" compositions and ragas from the setlist rows
 * of their events. Pure, so the live read path (before denormalization) and the
 * rebuild-repertoire sweep share one definition and cannot disagree on the counts.
 *
 * `rows` must already exclude soft-deleted events; the caller owns that filter, exactly
 * as `collaboratorsFrom` requires.
 */
export function computeRepertoire(rows: RepertoireSetlistRow[]): Repertoire {
  const compositionCounts = new Map<string, { title: string; count: number }>();
  const ragaCounts = new Map<string, { name: string; count: number }>();

  for (const row of rows) {
    if (row.compositionId) {
      const entry = compositionCounts.get(row.compositionId);
      if (entry) {
        entry.count += 1;
      } else {
        compositionCounts.set(row.compositionId, {
          title: row.compositionTitle ?? row.compositionId,
          count: 1,
        });
      }
    }
    if (row.ragaId) {
      const entry = ragaCounts.get(row.ragaId);
      if (entry) {
        entry.count += 1;
      } else {
        ragaCounts.set(row.ragaId, { name: row.ragaName ?? row.ragaId, count: 1 });
      }
    }
  }

  return {
    topCompositions: [...compositionCounts.entries()]
      .map(([id, { title, count }]) => ({ id, title, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, TOP_N),
    topRagas: [...ragaCounts.entries()]
      .map(([id, { name, count }]) => ({ id, name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, TOP_N),
  };
}
