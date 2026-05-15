import { TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoClient } from '../../db/client';
import { EventSetlistEntity } from './entity';
import type { EventSetlist } from './entity';

export { recomputeEventSetlist } from './reconcile';

export async function getEventSetlist(eventId: string): Promise<EventSetlist[]> {
  const result = await EventSetlistEntity.query
    .primary({ eventId })
    .go({ order: 'asc', pages: 'all' });
  return (result.data ?? []) as EventSetlist[];
}

export async function deleteAllEventSetlistRows(eventId: string): Promise<void> {
  const existing = await getEventSetlist(eventId);
  if (existing.length === 0) return;

  const deleteOps = existing.map(row => {
    const { Key, TableName } = EventSetlistEntity.delete({
      eventId,
      orderStr: row.orderStr,
    }).params();
    return { Delete: { TableName, Key } };
  });

  for (let i = 0; i < deleteOps.length; i += 100) {
    await dynamoClient.send(
      new TransactWriteCommand({ TransactItems: deleteOps.slice(i, i + 100) })
    );
  }
}

export async function writeEventSetlistRows(
  eventId: string,
  rows: EventSetlist[],
  existing: EventSetlist[]
): Promise<void> {
  const deleteOps = existing.map(row => {
    const { Key, TableName } = EventSetlistEntity.delete({
      eventId,
      orderStr: row.orderStr,
    }).params();
    return { Delete: { TableName, Key } };
  });

  const putOps = rows.map(row => {
    // .put() avoids attribute_not_exists condition — safer in concurrent reconcile scenarios.
    const { Item, TableName } = EventSetlistEntity.put(row).params();
    return { Put: { TableName, Item } };
  });

  const combined = [...deleteOps, ...putOps];
  if (combined.length === 0) return;

  if (combined.length <= 100) {
    await dynamoClient.send(new TransactWriteCommand({ TransactItems: combined }));
    return;
  }

  // Setlists large enough to exceed 100 ops: delete then put in batches.
  // Brief visibility gap is acceptable for unusually long setlists.
  for (let i = 0; i < deleteOps.length; i += 100) {
    await dynamoClient.send(
      new TransactWriteCommand({ TransactItems: deleteOps.slice(i, i + 100) })
    );
  }
  for (let i = 0; i < putOps.length; i += 100) {
    await dynamoClient.send(new TransactWriteCommand({ TransactItems: putOps.slice(i, i + 100) }));
  }
}

export async function listDisputedSetlistItems(params?: {
  limit?: number;
  nextToken?: string;
}): Promise<{ items: EventSetlist[]; nextToken?: string; hasMore: boolean }> {
  const result = await EventSetlistEntity.query
    .byStatus({ status: 'disputed' })
    .go({ order: 'desc', limit: params?.limit ?? 20, cursor: params?.nextToken });
  return {
    items: (result.data ?? []) as EventSetlist[],
    nextToken: result.cursor ?? undefined,
    hasMore: !!result.cursor,
  };
}

export async function updateEventSetlistRow(
  eventId: string,
  order: number,
  updates: Partial<EventSetlist>
): Promise<EventSetlist> {
  const orderStr = order.toString().padStart(4, '0');
  const result = await EventSetlistEntity.patch({ eventId, orderStr })
    .set(updates as Parameters<ReturnType<typeof EventSetlistEntity.patch>['set']>[0])
    .go({ response: 'all_new' });
  return result.data as EventSetlist;
}

export async function verifyEventSetlistRow(
  eventId: string,
  order: number,
  updates: Partial<EventSetlist>
): Promise<EventSetlist> {
  return updateEventSetlistRow(eventId, order, { ...updates, status: 'verified' });
}

export async function unlockEventSetlistRow(eventId: string, order: number): Promise<EventSetlist> {
  return updateEventSetlistRow(eventId, order, { status: 'derived' });
}

export type { EventSetlist, EventSetlistStatus } from './entity';
