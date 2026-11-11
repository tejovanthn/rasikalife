import { findSimilarFestivals, suggestFestivalKeeper } from '../festival/duplicates';
import type { FestivalCandidate } from '../festival/duplicates';
import { findLikelyDuplicates } from './duplicates';
import type { LikelyCandidate } from './duplicates';
import { suggestEventKeeper } from './merge-fill';

/**
 * Groups of events (and festivals) that are probably one listed twice, for the
 * `event-duplicates` sweep. Pure: the script loads the rows, this finds the groups.
 *
 * A group is a connected set under `findLikelyDuplicates`, so a pair a person already answered
 * with `notDuplicateOf` is not reported. Each group has one suggested keeper and a loser per
 * remaining row, because a merge is always loser-into-keeper.
 */

type SweepEvent = LikelyCandidate & { createdAt?: string; posterUrl?: string | null };

export interface DuplicatePair<T> {
  keeper: T;
  loser: T;
  /** The group this pair came from; losers of one group share a keeper. */
  group: number;
}

function components<T extends { id: string }>(rows: T[], related: (row: T) => T[]): T[][] {
  const parent = new Map(rows.map(r => [r.id, r.id]));
  const find = (id: string): string => {
    let root = id;
    while (parent.get(root) !== root) root = parent.get(root) as string;
    parent.set(id, root);
    return root;
  };
  for (const row of rows) {
    for (const other of related(row)) parent.set(find(row.id), find(other.id));
  }
  const groups = new Map<string, T[]>();
  for (const row of rows) groups.set(find(row.id), [...(groups.get(find(row.id)) ?? []), row]);
  return [...groups.values()].filter(g => g.length > 1);
}

function pairsOf<T extends { id: string }>(
  groups: T[][],
  pick: (a: T, b: T) => { keeper: T; loser: T }
): Array<DuplicatePair<T>> {
  return groups.flatMap((group, index) => {
    const keeper = group.reduce((best, row) => pick(best, row).keeper);
    return group
      .filter(row => row.id !== keeper.id)
      .map(loser => ({ keeper, loser, group: index + 1 }));
  });
}

export function groupLikelyDuplicateEvents<T extends SweepEvent>(
  events: T[]
): Array<DuplicatePair<T>> {
  const byVenue = new Map<string, T[]>();
  for (const e of events) {
    if (e.venueId) byVenue.set(e.venueId, [...(byVenue.get(e.venueId) ?? []), e]);
  }
  const groups = [...byVenue.values()].flatMap(rows =>
    components(rows, row => findLikelyDuplicates(rows, row))
  );
  return pairsOf(groups, suggestEventKeeper);
}

export function groupSimilarFestivals<
  T extends FestivalCandidate & { createdAt?: string; eventCount?: number },
>(festivals: T[]): Array<DuplicatePair<T>> {
  const groups = components(festivals, f => findSimilarFestivals(festivals, f));
  return pairsOf(groups, suggestFestivalKeeper);
}
