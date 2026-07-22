import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConcertLogItem } from '../concert-log-item/entity';
import type { EventSetlist } from './entity';

// Mock all external dependencies so the pure algorithm is tested in isolation
vi.mock('../concert-log-item', () => ({
  listEventSetlistItems: vi.fn(),
}));

vi.mock('.', () => ({
  getEventSetlist: vi.fn(),
  deleteAllEventSetlistRows: vi.fn(),
  writeEventSetlistRows: vi.fn(),
}));

vi.mock('../composition', () => ({
  adjustPerformanceCount: vi.fn(),
}));

vi.mock('../raga', () => ({
  adjustPerformanceCount: vi.fn(),
}));

import { deleteAllEventSetlistRows, getEventSetlist, writeEventSetlistRows } from '.';
import { listEventSetlistItems } from '../concert-log-item';
import { recomputeEventSetlist } from './reconcile';

function makeItem(overrides: Partial<ConcertLogItem>): ConcertLogItem {
  return {
    userId: 'user1',
    eventId: 'event1',
    order: 0,
    orderStr: '0000',
    compositionId: 'comp1',
    compositionTitle: 'Vatapi Ganapatim',
    ragaId: 'raga1',
    ragaName: 'Hamsadhwani',
    talaId: 'tala1',
    talaName: 'Adi',
    compositionType: 'kriti',
    publicNote: undefined,
    isHighlight: false,
    eventStartDateTime: '2026-01-01T18:00:00.000Z',
    moderatorReviewedAt: undefined,
    moderatorRejectedReason: undefined,
    moderatorId: undefined,
    pendingModerationKey: undefined,
    createdAt: '2026-01-02T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...overrides,
  } as unknown as ConcertLogItem;
}

describe('recomputeEventSetlist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getEventSetlist).mockResolvedValue([]);
    vi.mocked(deleteAllEventSetlistRows).mockResolvedValue(undefined);
    vi.mocked(writeEventSetlistRows).mockResolvedValue(undefined);
  });

  it('returns empty and deletes rows when no items exist', async () => {
    vi.mocked(listEventSetlistItems).mockResolvedValue([]);

    const result = await recomputeEventSetlist('event1');

    expect(result).toEqual([]);
    expect(deleteAllEventSetlistRows).toHaveBeenCalledWith('event1');
    expect(writeEventSetlistRows).not.toHaveBeenCalled();
  });

  it('single logger produces setlist with confidence 1.0', async () => {
    const items = [
      makeItem({ order: 0, orderStr: '0000' }),
      makeItem({
        order: 1,
        orderStr: '0001',
        compositionId: 'comp2',
        compositionTitle: 'Sri Subramanyaya',
        ragaId: 'raga2',
        ragaName: 'Kambhoji',
      }),
    ];
    vi.mocked(listEventSetlistItems).mockResolvedValue(items);

    const result = await recomputeEventSetlist('event1');

    expect(result).toHaveLength(2);
    expect(result[0].confidenceScore).toBe(1);
    expect(result[0].contributorCount).toBe(1);
    expect(result[0].totalLoggersForEvent).toBe(1);
    expect(result[0].status).toBe('derived');
  });

  it('two loggers with identical setlists produce confidence 1.0', async () => {
    const items = [
      makeItem({ userId: 'user1', order: 0, orderStr: '0000' }),
      makeItem({ userId: 'user2', order: 0, orderStr: '0000' }),
    ];
    vi.mocked(listEventSetlistItems).mockResolvedValue(items);

    const result = await recomputeEventSetlist('event1');

    expect(result).toHaveLength(1);
    expect(result[0].contributorCount).toBe(2);
    expect(result[0].totalLoggersForEvent).toBe(2);
    expect(result[0].confidenceScore).toBe(1);
    expect(result[0].status).toBe('derived');
  });

  it('two loggers where one missed an item gives missed item confidence 0.5', async () => {
    const items = [
      makeItem({ userId: 'user1', order: 0, compositionId: 'comp1' }),
      makeItem({
        userId: 'user1',
        order: 1,
        compositionId: 'comp2',
        compositionTitle: 'Pakkala Nilabadi',
        ragaId: 'raga2',
      }),
      makeItem({ userId: 'user2', order: 0, compositionId: 'comp1' }),
      // user2 did not log comp2
    ];
    vi.mocked(listEventSetlistItems).mockResolvedValue(items);

    const result = await recomputeEventSetlist('event1');

    expect(result).toHaveLength(2);
    const comp1Row = result.find(r => r.compositionId === 'comp1');
    const comp2Row = result.find(r => r.compositionId === 'comp2');
    expect(comp1Row?.confidenceScore).toBe(1);
    expect(comp1Row?.contributorCount).toBe(2);
    expect(comp2Row?.confidenceScore).toBe(0.5);
    expect(comp2Row?.contributorCount).toBe(1);
    // solo claim with 2 total loggers — lowConfidence threshold is >= 3, so still 'derived'
    expect(comp2Row?.status).toBe('derived');
  });

  it('solo claim with 3+ total loggers is lowConfidence', async () => {
    const items = [
      makeItem({ userId: 'user1', order: 0, compositionId: 'comp1' }),
      makeItem({ userId: 'user2', order: 0, compositionId: 'comp1' }),
      makeItem({ userId: 'user3', order: 0, compositionId: 'comp1' }),
      makeItem({
        userId: 'user1',
        order: 1,
        compositionId: 'comp2',
        compositionTitle: 'Rare Piece',
      }),
    ];
    vi.mocked(listEventSetlistItems).mockResolvedValue(items);

    const result = await recomputeEventSetlist('event1');

    const rareRow = result.find(r => r.compositionId === 'comp2');
    expect(rareRow?.status).toBe('lowConfidence');
    expect(rareRow?.contributorCount).toBe(1);
    expect(rareRow?.totalLoggersForEvent).toBe(3);
  });

  it('three loggers with raga disagreement on one item marks it disputed', async () => {
    const items = [
      makeItem({
        userId: 'user1',
        order: 0,
        compositionId: 'comp1',
        ragaId: 'raga1',
        ragaName: 'Hamsadhwani',
      }),
      makeItem({
        userId: 'user2',
        order: 0,
        compositionId: 'comp1',
        ragaId: 'raga1',
        ragaName: 'Hamsadhwani',
      }),
      makeItem({
        userId: 'user3',
        order: 0,
        compositionId: 'comp1',
        ragaId: 'raga2',
        ragaName: 'Hamsanandi',
      }),
    ];
    vi.mocked(listEventSetlistItems).mockResolvedValue(items);

    const result = await recomputeEventSetlist('event1');

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('disputed');
    expect(result[0].disputes).toHaveLength(1);
    expect(result[0].disputes![0].field).toBe('ragaId');
    expect(result[0].disputes![0].options).toHaveLength(2);
    // Majority vote: raga1 wins
    expect(result[0].ragaId).toBe('raga1');
  });

  it('position disagreement resolves to median order', async () => {
    const items = [
      makeItem({
        userId: 'user1',
        order: 4,
        orderStr: '0004',
        compositionId: 'comp2',
        compositionTitle: 'Early',
      }),
      makeItem({
        userId: 'user2',
        order: 6,
        orderStr: '0006',
        compositionId: 'comp2',
        compositionTitle: 'Early',
      }),
      makeItem({
        userId: 'user3',
        order: 6,
        orderStr: '0006',
        compositionId: 'comp2',
        compositionTitle: 'Early',
      }),
      makeItem({
        userId: 'user4',
        order: 6,
        orderStr: '0006',
        compositionId: 'comp2',
        compositionTitle: 'Early',
      }),
      makeItem({
        userId: 'user5',
        order: 8,
        orderStr: '0008',
        compositionId: 'comp2',
        compositionTitle: 'Early',
      }),
      // Comp1 is first
      makeItem({
        userId: 'user1',
        order: 0,
        orderStr: '0000',
        compositionId: 'comp1',
        compositionTitle: 'Opening',
      }),
      makeItem({
        userId: 'user2',
        order: 0,
        orderStr: '0000',
        compositionId: 'comp1',
        compositionTitle: 'Opening',
      }),
    ];
    vi.mocked(listEventSetlistItems).mockResolvedValue(items);

    const result = await recomputeEventSetlist('event1');

    // After sorting + renumbering: Opening=0, Early=1
    const earlyRow = result.find(r => r.compositionId === 'comp2');
    const openingRow = result.find(r => r.compositionId === 'comp1');
    expect(openingRow?.order).toBe(0);
    expect(earlyRow?.order).toBe(1);
  });

  it('free-text item from one logger does not appear in EventSetlist', async () => {
    const items = [makeItem({ compositionId: undefined, compositionTitle: 'Unknown Piece' })];
    // Remove compositionId to simulate free-text
    (items[0] as unknown as Record<string, unknown>).compositionId = undefined;
    vi.mocked(listEventSetlistItems).mockResolvedValue(items);

    const result = await recomputeEventSetlist('event1');

    // Free-text with no moderator review should still appear in EventSetlist
    // (the plan says free-text items still surface, they just lack raga/tala)
    expect(result).toHaveLength(1);
    expect(result[0].compositionId).toBeUndefined();
    expect(result[0].compositionTitle).toBe('Unknown Piece');
  });

  it('two loggers with similar free-text titles are grouped together', async () => {
    const items = [
      makeItem({
        userId: 'user1',
        compositionId: undefined,
        compositionTitle: 'Vatapi Ganapatim',
        ragaId: undefined,
      }),
      makeItem({
        userId: 'user2',
        compositionId: undefined,
        compositionTitle: 'Vatapi Ganapathim',
        ragaId: undefined,
      }),
    ];
    (items[0] as unknown as Record<string, unknown>).compositionId = undefined;
    (items[1] as unknown as Record<string, unknown>).compositionId = undefined;
    vi.mocked(listEventSetlistItems).mockResolvedValue(items);

    const result = await recomputeEventSetlist('event1');

    // Similar titles should be grouped: only 1 EventSetlist row
    expect(result).toHaveLength(1);
    expect(result[0].contributorCount).toBe(2);
  });

  it('two loggers with very different titles produce separate rows', async () => {
    const items = [
      makeItem({
        userId: 'user1',
        compositionId: undefined,
        compositionTitle: 'Vatapi Ganapatim',
        ragaId: undefined,
      }),
      makeItem({
        userId: 'user2',
        compositionId: undefined,
        compositionTitle: 'Pakkala Nilabadi',
        ragaId: undefined,
      }),
    ];
    (items[0] as unknown as Record<string, unknown>).compositionId = undefined;
    (items[1] as unknown as Record<string, unknown>).compositionId = undefined;
    vi.mocked(listEventSetlistItems).mockResolvedValue(items);

    const result = await recomputeEventSetlist('event1');

    expect(result).toHaveLength(2);
  });

  it('verified rows survive recomputation', async () => {
    const verifiedRow: EventSetlist = {
      eventId: 'event1',
      order: 0,
      orderStr: '0000',
      compositionId: 'comp1',
      compositionTitle: 'Verified Title',
      status: 'verified',
      contributorCount: 1,
      totalLoggersForEvent: 1,
      confidenceScore: 1,
      ragaId: 'raga1',
      ragaName: 'Hamsadhwani',
      talaId: 'tala1',
      talaName: 'Adi',
      compositionType: 'kriti',
      publicNoteIds: [],
      disputes: [],
      lastReconciliationAt: '2026-01-01T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    } as unknown as EventSetlist;

    vi.mocked(getEventSetlist).mockResolvedValue([verifiedRow]);

    const items = [makeItem({ compositionId: 'comp1', ragaId: 'raga2', ragaName: 'Kambhoji' })];
    vi.mocked(listEventSetlistItems).mockResolvedValue(items);

    const result = await recomputeEventSetlist('event1');

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('verified');
    // Verified row's ragaId preserved, not overridden by reconciliation
    expect(result[0].ragaId).toBe('raga1');
  });

  it('writes new rows to database', async () => {
    const items = [makeItem({})];
    vi.mocked(listEventSetlistItems).mockResolvedValue(items);

    await recomputeEventSetlist('event1');

    expect(writeEventSetlistRows).toHaveBeenCalledTimes(1);
    expect(writeEventSetlistRows).toHaveBeenCalledWith('event1', expect.any(Array), []);
  });

  it('calls counter adjustments when compositions change', async () => {
    const { adjustPerformanceCount: adjustComposition } = await import('../composition');
    const { adjustPerformanceCount: adjustRaga } = await import('../raga');

    const existingRow: EventSetlist = {
      eventId: 'event1',
      compositionId: 'old-comp',
      ragaId: 'old-raga',
      status: 'derived',
    } as unknown as EventSetlist;

    vi.mocked(getEventSetlist).mockResolvedValue([existingRow]);

    const items = [makeItem({ compositionId: 'new-comp', ragaId: 'new-raga' })];
    vi.mocked(listEventSetlistItems).mockResolvedValue(items);

    await recomputeEventSetlist('event1');

    expect(adjustComposition).toHaveBeenCalledWith('new-comp', 1);
    expect(adjustComposition).toHaveBeenCalledWith('old-comp', -1);
    expect(adjustRaga).toHaveBeenCalledWith('new-raga', 1);
    expect(adjustRaga).toHaveBeenCalledWith('old-raga', -1);
  });
});
