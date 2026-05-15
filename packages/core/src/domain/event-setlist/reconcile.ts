import { deleteAllEventSetlistRows, getEventSetlist, writeEventSetlistRows } from '.';
import { adjustPerformanceCount as adjustCompositionPerformanceCount } from '../composition';
import { listEventSetlistItems } from '../concert-log-item';
import type { ConcertLogItem } from '../concert-log-item/entity';
import { adjustPerformanceCount as adjustRagaPerformanceCount } from '../raga';
import type { EventSetlist } from './entity';

type DisputeOption = { value: string; count: number };
type Dispute = { field: string; options: DisputeOption[] };

type ReconcileGroup = {
  compositionId?: string;
  compositionTitle: string;
  members: ConcertLogItem[];
};

// Levenshtein similarity: 1 = identical, 0 = completely different
function similarity(a: string, b: string): number {
  const s = a.toLowerCase().trim();
  const t = b.toLowerCase().trim();
  if (s === t) return 1;
  if (s.length === 0 || t.length === 0) return 0;

  let prev = Array.from({ length: t.length + 1 }, (_, j) => j);
  let curr = new Array<number>(t.length + 1);

  for (let i = 1; i <= s.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= t.length; j++) {
      curr[j] =
        s[i - 1] === t[j - 1] ? prev[j - 1] : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
    }
    [prev, curr] = [curr, prev];
  }

  return 1 - prev[t.length] / Math.max(s.length, t.length);
}

function fuzzyGroupUnlinked(items: ConcertLogItem[], threshold = 0.85): ReconcileGroup[] {
  const groups: ReconcileGroup[] = [];

  for (const item of items) {
    let matched = false;
    for (const group of groups) {
      if (similarity(item.compositionTitle, group.compositionTitle) >= threshold) {
        group.members.push(item);
        matched = true;
        break;
      }
    }
    if (!matched) {
      groups.push({ compositionTitle: item.compositionTitle, members: [item] });
    }
  }

  return groups;
}

function median(nums: number[]): number {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function majorityVote<T>(values: (T | undefined)[]): T | undefined {
  const defined = values.filter((v): v is T => v !== undefined && v !== null);
  if (defined.length === 0) return undefined;

  const counts = new Map<string, { value: T; count: number }>();
  for (const v of defined) {
    const key = String(v);
    const entry = counts.get(key);
    if (entry) {
      entry.count++;
    } else {
      counts.set(key, { value: v, count: 1 });
    }
  }

  let winner: T | undefined;
  let maxCount = 0;
  for (const { value, count } of counts.values()) {
    if (count > maxCount) {
      maxCount = count;
      winner = value;
    }
  }
  return winner;
}

function detectDisputesForField<T>(field: string, values: (T | undefined)[]): Dispute | undefined {
  const defined = values.filter((v): v is T => v !== undefined && v !== null);
  if (defined.length === 0) return undefined;

  const counts = new Map<string, number>();
  for (const v of defined) {
    const key = String(v);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  if (counts.size <= 1) return undefined;

  return {
    field,
    options: Array.from(counts.entries()).map(([value, count]) => ({ value, count })),
  };
}

function groupLinked(items: ConcertLogItem[]): ReconcileGroup[] {
  const byCompositionId = new Map<string, ConcertLogItem[]>();
  for (const item of items) {
    const id = item.compositionId as string;
    const group = byCompositionId.get(id) ?? [];
    group.push(item);
    byCompositionId.set(id, group);
  }

  return Array.from(byCompositionId.entries()).map(([compositionId, members]) => ({
    compositionId,
    compositionTitle: members[0].compositionTitle,
    members,
  }));
}

function buildSetlistRow(
  group: ReconcileGroup,
  totalLoggers: number,
  rowIndex: number,
  eventId: string
): Omit<EventSetlist, 'createdAt' | 'updatedAt' | 'orderStr' | 'lastReconciliationAt'> {
  const { members } = group;
  const uniqueUserIds = new Set(members.map(m => m.userId));
  const contributorCount = uniqueUserIds.size;
  const confidenceScore = totalLoggers > 0 ? contributorCount / totalLoggers : 1;

  const canonicalRaga = majorityVote(members.map(m => m.ragaId));
  const canonicalRagaName = majorityVote(members.map(m => m.ragaName));
  const canonicalTala = majorityVote(members.map(m => m.talaId));
  const canonicalTalaName = majorityVote(members.map(m => m.talaName));
  const canonicalType = majorityVote(members.map(m => m.compositionType));

  const disputes: Dispute[] = [];
  const ragaDispute = detectDisputesForField(
    'ragaId',
    members.map(m => m.ragaId)
  );
  if (ragaDispute) disputes.push(ragaDispute);
  const talaDispute = detectDisputesForField(
    'talaId',
    members.map(m => m.talaId)
  );
  if (talaDispute) disputes.push(talaDispute);
  const typeDispute = detectDisputesForField(
    'compositionType',
    members.map(m => m.compositionType)
  );
  if (typeDispute) disputes.push(typeDispute);

  let status: EventSetlist['status'] = 'derived';
  if (disputes.length > 0) {
    status = 'disputed';
  } else if (contributorCount === 1 && totalLoggers >= 3) {
    status = 'lowConfidence';
  }

  const publicNoteIds = members
    .filter(m => m.publicNote)
    .map(m => `${m.userId}#${m.eventId}#${m.orderStr}`);

  return {
    eventId,
    order: rowIndex,
    compositionId: group.compositionId,
    compositionTitle: group.compositionTitle,
    ragaId: canonicalRaga,
    ragaName: canonicalRagaName,
    talaId: canonicalTala,
    talaName: canonicalTalaName,
    compositionType: canonicalType,
    contributorCount,
    totalLoggersForEvent: totalLoggers,
    confidenceScore,
    status,
    publicNoteIds,
    disputes,
  };
}

export async function recomputeEventSetlist(eventId: string): Promise<EventSetlist[]> {
  const [allItems, existingSetlist] = await Promise.all([
    listEventSetlistItems(eventId),
    getEventSetlist(eventId),
  ]);

  if (allItems.length === 0) {
    await deleteAllEventSetlistRows(eventId);
    await updateCountersFromDiff(eventId, existingSetlist, []);
    return [];
  }

  const uniqueUserIds = new Set(allItems.map(i => i.userId));
  const totalLoggers = uniqueUserIds.size;

  const linked = allItems.filter(i => i.compositionId);
  const unlinked = allItems.filter(i => !i.compositionId);

  const linkedGroups = groupLinked(linked);
  const unlinkedGroups = fuzzyGroupUnlinked(unlinked);

  const allGroups = [...linkedGroups, ...unlinkedGroups];

  // Sort groups by median order position across contributors
  const groupsWithOrder = allGroups.map(group => ({
    group,
    medianOrder: median(group.members.map(m => m.order)),
  }));
  groupsWithOrder.sort((a, b) => a.medianOrder - b.medianOrder);

  // Preserve verified rows — they override reconciled rows for the same composition
  const verifiedByCompositionId = new Map<string, EventSetlist>();
  const verifiedByTitle = new Map<string, EventSetlist>();
  for (const row of existingSetlist) {
    if (row.status === 'verified') {
      if (row.compositionId) {
        verifiedByCompositionId.set(row.compositionId, row);
      } else {
        verifiedByTitle.set(row.compositionTitle.toLowerCase(), row);
      }
    }
  }

  const newRows: EventSetlist[] = [];
  let rowIndex = 0;

  for (const { group } of groupsWithOrder) {
    // Check if there's a verified row for this group
    const verified = group.compositionId
      ? verifiedByCompositionId.get(group.compositionId)
      : verifiedByTitle.get(group.compositionTitle.toLowerCase());

    if (verified) {
      newRows.push({ ...verified, order: rowIndex, totalLoggersForEvent: totalLoggers });
      rowIndex++;
      continue;
    }

    const row = buildSetlistRow(group, totalLoggers, rowIndex, eventId);
    newRows.push({
      ...row,
      lastReconciliationAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as EventSetlist);
    rowIndex++;
  }

  await writeEventSetlistRows(eventId, newRows, existingSetlist);
  await updateCountersFromDiff(eventId, existingSetlist, newRows);

  return newRows;
}

async function updateCountersFromDiff(
  _eventId: string,
  previous: EventSetlist[],
  next: EventSetlist[]
): Promise<void> {
  // Compare unique composition/raga IDs appearing in this event's setlist before vs after.
  // Each unique (compositionId, event) pair counts as 1 toward the global performanceCount.
  // We use Sets so that a composition appearing multiple times in one event only adds/removes 1.
  const prevCompositionIds = new Set(
    previous.map(r => r.compositionId).filter((id): id is string => Boolean(id))
  );
  const nextCompositionIds = new Set(
    next.map(r => r.compositionId).filter((id): id is string => Boolean(id))
  );
  const prevRagaIds = new Set(
    previous.map(r => r.ragaId).filter((id): id is string => Boolean(id))
  );
  const nextRagaIds = new Set(next.map(r => r.ragaId).filter((id): id is string => Boolean(id)));

  const addedCompositions = [...nextCompositionIds].filter(id => !prevCompositionIds.has(id));
  const removedCompositions = [...prevCompositionIds].filter(id => !nextCompositionIds.has(id));
  const addedRagas = [...nextRagaIds].filter(id => !prevRagaIds.has(id));
  const removedRagas = [...prevRagaIds].filter(id => !nextRagaIds.has(id));

  await Promise.all([
    ...addedCompositions.map(id => adjustCompositionPerformanceCount(id, 1)),
    ...removedCompositions.map(id => adjustCompositionPerformanceCount(id, -1)),
    ...addedRagas.map(id => adjustRagaPerformanceCount(id, 1)),
    ...removedRagas.map(id => adjustRagaPerformanceCount(id, -1)),
  ]);
  // Note: performanceCount = number of events with a derived/verified row for this entity.
  // The nightly recompute-performance-counts script corrects any drift from concurrent updates.
}
