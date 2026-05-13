import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { TABLE_NAME, dynamoClient } from '../../db/client';
import { EventEntity } from '../event/entity';
import { getEvent } from '../event';
import { ConcertLogEntity } from './entity';
import type { ConcertLog } from './entity';

async function adjustAttendedCounter(eventId: string, delta: 1 | -1): Promise<void> {
  await dynamoClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { pk: `EVENT#${eventId}`, sk: '#METADATA' },
      UpdateExpression: 'ADD attendedCount :delta',
      ExpressionAttributeValues: { ':delta': delta },
    })
  );
}

export async function upsertConcertLog(
  userId: string,
  eventId: string,
  params?: { notes?: string }
): Promise<ConcertLog> {
  const existing = await ConcertLogEntity.get({ userId, eventId }).go();

  if (existing.data) {
    const result = await ConcertLogEntity.patch({ userId, eventId })
      .set({ notes: params?.notes ?? existing.data.notes })
      .go({ response: 'all_new' });
    return result.data as ConcertLog;
  }

  const event = await getEvent(eventId);
  if (!event) {
    throw new Error(`Event ${eventId} not found`);
  }

  const [result] = await Promise.all([
    ConcertLogEntity.create({
      userId,
      eventId,
      eventTitle: event.title,
      eventStartDateTime: event.startDateTime,
      venueName: event.venueName,
      artistNames: (event.artists ?? []).map(a => a.name),
      notes: params?.notes,
    }).go(),
    adjustAttendedCounter(eventId, 1),
  ]);

  return result.data as ConcertLog;
}

export async function deleteConcertLog(userId: string, eventId: string): Promise<void> {
  const existing = await ConcertLogEntity.get({ userId, eventId }).go();
  if (!existing.data) return;

  await Promise.all([
    ConcertLogEntity.delete({ userId, eventId }).go(),
    adjustAttendedCounter(eventId, -1),
  ]);
}

export async function getConcertLog(userId: string, eventId: string): Promise<ConcertLog | null> {
  const result = await ConcertLogEntity.get({ userId, eventId }).go();
  return result.data ?? null;
}

export async function listUserConcertLogs(
  userId: string,
  params?: { limit?: number; nextToken?: string }
): Promise<{ items: ConcertLog[]; nextToken?: string; hasMore: boolean }> {
  const result = await ConcertLogEntity.query
    .byUserDate({ userId })
    .go({ order: 'desc', limit: params?.limit ?? 50, cursor: params?.nextToken });

  return {
    items: (result.data ?? []) as ConcertLog[],
    nextToken: result.cursor ?? undefined,
    hasMore: !!result.cursor,
  };
}

export async function listEventConcertLogs(
  eventId: string,
  params?: { limit?: number; nextToken?: string }
): Promise<{ items: ConcertLog[]; nextToken?: string; hasMore: boolean }> {
  const result = await ConcertLogEntity.query
    .byEvent({ eventId })
    .go({ limit: params?.limit ?? 20, cursor: params?.nextToken });

  return {
    items: (result.data ?? []) as ConcertLog[],
    nextToken: result.cursor ?? undefined,
    hasMore: !!result.cursor,
  };
}

export async function getAttendedCount(eventId: string): Promise<number> {
  const result = await EventEntity.get({ id: eventId }).go();
  return result.data?.attendedCount ?? 0;
}

export type { ConcertLog } from './entity';
