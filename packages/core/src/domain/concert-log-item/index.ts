import { TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoClient } from '../../db/client';
import { ConcertLogItemEntity } from './entity';
import type { ConcertLogItem } from './entity';

export type UpsertSetlistItemInput = {
  compositionId?: string;
  compositionTitle: string;
  ragaId?: string;
  ragaName?: string;
  talaId?: string;
  talaName?: string;
  compositionType?: string;
  publicNote?: string;
  isHighlight?: boolean;
  eventStartDateTime: string;
};

export async function upsertSetlistItem(
  userId: string,
  eventId: string,
  order: number,
  input: UpsertSetlistItemInput
): Promise<ConcertLogItem> {
  const result = await ConcertLogItemEntity.put({
    userId,
    eventId,
    order,
    compositionId: input.compositionId,
    compositionTitle: input.compositionTitle,
    ragaId: input.ragaId,
    ragaName: input.ragaName,
    talaId: input.talaId,
    talaName: input.talaName,
    compositionType: input.compositionType,
    publicNote: input.publicNote,
    isHighlight: input.isHighlight ?? false,
    eventStartDateTime: input.eventStartDateTime,
  }).go({ response: 'all_new' });
  return result.data as ConcertLogItem;
}

export async function deleteSetlistItem(
  userId: string,
  eventId: string,
  order: number
): Promise<void> {
  await ConcertLogItemEntity.delete({
    userId,
    eventId,
    orderStr: order.toString().padStart(4, '0'),
  }).go();
}

export async function replaceUserSetlist(
  userId: string,
  eventId: string,
  items: (UpsertSetlistItemInput & { order: number })[]
): Promise<void> {
  const existing = await listUserSetlist(userId, eventId);
  const nextOrderStrs = new Set(items.map(i => i.order.toString().padStart(4, '0')));

  // Only delete rows whose order is being removed; put handles upserts
  const toDelete = existing.filter(e => !nextOrderStrs.has(e.orderStr));

  const deleteOps = toDelete.map(item => {
    const { Key, TableName } = ConcertLogItemEntity.delete({
      userId,
      eventId,
      orderStr: item.orderStr,
    }).params();
    return { Delete: { TableName, Key } };
  });

  const putOps = items.map(item => {
    // .put() is a true upsert — no attribute_not_exists condition, so updating
    // an existing row at the same order position works correctly.
    const { Item, TableName } = ConcertLogItemEntity.put({
      userId,
      eventId,
      order: item.order,
      compositionId: item.compositionId,
      compositionTitle: item.compositionTitle,
      ragaId: item.ragaId,
      ragaName: item.ragaName,
      talaId: item.talaId,
      talaName: item.talaName,
      compositionType: item.compositionType,
      publicNote: item.publicNote,
      isHighlight: item.isHighlight ?? false,
      eventStartDateTime: item.eventStartDateTime,
    }).params();
    return { Put: { TableName, Item } };
  });

  const ops = [...deleteOps, ...putOps];
  // tRPC caps items at 50; deletes are bounded by the previous submission (also ≤50).
  // So max ops = 50 deletes + 50 puts = 100 — within DynamoDB TransactWriteItems limit.
  if (ops.length > 100)
    throw new Error(`Transaction would exceed DynamoDB 100-op limit: ${ops.length} ops`);
  if (ops.length > 0) {
    await dynamoClient.send(new TransactWriteCommand({ TransactItems: ops }));
  }
}

export async function listUserSetlist(userId: string, eventId: string): Promise<ConcertLogItem[]> {
  const result = await ConcertLogItemEntity.query.primary({ userId, eventId }).go({ order: 'asc' });
  return (result.data ?? []) as ConcertLogItem[];
}

export async function listEventSetlistItems(eventId: string): Promise<ConcertLogItem[]> {
  const result = await ConcertLogItemEntity.query
    .byEvent({ eventId })
    .go({ order: 'asc', pages: 'all' });
  return (result.data ?? []) as ConcertLogItem[];
}

export async function listPerformancesByComposition(
  compositionId: string,
  params?: { limit?: number; nextToken?: string }
): Promise<{ items: ConcertLogItem[]; nextToken?: string; hasMore: boolean }> {
  const compositionPerfKey = `COMPOSITION_PERFORMANCES#${compositionId}`;
  const result = await ConcertLogItemEntity.query
    .byComposition({ compositionPerfKey })
    .go({ order: 'desc', limit: params?.limit ?? 20, cursor: params?.nextToken });
  return {
    items: (result.data ?? []) as ConcertLogItem[],
    nextToken: result.cursor ?? undefined,
    hasMore: !!result.cursor,
  };
}

export async function listPerformancesByRaga(
  ragaId: string,
  params?: { limit?: number; nextToken?: string }
): Promise<{ items: ConcertLogItem[]; nextToken?: string; hasMore: boolean }> {
  const ragaPerfKey = `RAGA_PERFORMANCES#${ragaId}`;
  const result = await ConcertLogItemEntity.query
    .byRaga({ ragaPerfKey })
    .go({ order: 'desc', limit: params?.limit ?? 20, cursor: params?.nextToken });
  return {
    items: (result.data ?? []) as ConcertLogItem[],
    nextToken: result.cursor ?? undefined,
    hasMore: !!result.cursor,
  };
}

export async function listPendingFreeTextItems(params?: {
  limit?: number;
  nextToken?: string;
}): Promise<{ items: ConcertLogItem[]; nextToken?: string; hasMore: boolean }> {
  const result = await ConcertLogItemEntity.query
    .byPendingModeration({ pendingModerationKey: '1' })
    .go({ order: 'asc', limit: params?.limit ?? 20, cursor: params?.nextToken });
  return {
    items: (result.data ?? []) as ConcertLogItem[],
    nextToken: result.cursor ?? undefined,
    hasMore: !!result.cursor,
  };
}

export async function linkFreeTextToComposition(
  userId: string,
  eventId: string,
  order: number,
  compositionId: string,
  moderatorId: string
): Promise<ConcertLogItem> {
  const orderStr = order.toString().padStart(4, '0');
  const now = new Date().toISOString();
  const result = await ConcertLogItemEntity.patch({ userId, eventId, orderStr })
    // Explicitly include watched fields so the pendingModerationKey setter fires correctly
    .set({ compositionId, moderatorId, moderatorReviewedAt: now })
    .go({ response: 'all_new' });
  return result.data as ConcertLogItem;
}

export async function rejectFreeTextItem(
  userId: string,
  eventId: string,
  order: number,
  moderatorId: string,
  reason: string
): Promise<ConcertLogItem> {
  const orderStr = order.toString().padStart(4, '0');
  const now = new Date().toISOString();
  const result = await ConcertLogItemEntity.patch({ userId, eventId, orderStr })
    .set({ moderatorId, moderatorReviewedAt: now, moderatorRejectedReason: reason })
    .go({ response: 'all_new' });
  return result.data as ConcertLogItem;
}

export async function deleteAllUserSetlistItems(userId: string, eventId: string): Promise<void> {
  const items = await listUserSetlist(userId, eventId);
  if (items.length === 0) return;

  await Promise.all(
    items.map(item =>
      ConcertLogItemEntity.delete({ userId, eventId, orderStr: item.orderStr }).go()
    )
  );
}

export type { ConcertLogItem, CompositionType } from './entity';
export { COMPOSITION_TYPES } from './entity';
