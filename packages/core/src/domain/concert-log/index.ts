import { BatchGetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { TABLE_NAME, dynamoClient } from '../../db/client';
import { keyOfEntity } from '../../db/keys';
import { getEvent } from '../event';
import { EventEntity } from '../event/entity';
import type { Event } from '../event/entity';
import { RsvpEntity } from '../rsvp/entity';
import { ConcertLogEntity } from './entity';
import type { ConcertLog } from './entity';

async function adjustAttendedCounter(eventId: string, delta: 1 | -1): Promise<void> {
  await dynamoClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      // ElectroDB lowercases composite key values, so the key must be derived from
      // the entity rather than hand-built in uppercase, or this writes a phantom row.
      Key: keyOfEntity(EventEntity, { id: eventId }),
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

export async function listPastRsvpedWithoutLogs(userId: string, limit = 20): Promise<Event[]> {
  // Fetch user's RSVPs
  const rsvpResult = await RsvpEntity.query.byUser({ userId }).go({ order: 'desc', limit: 100 });

  const rsvps = rsvpResult.data ?? [];
  if (rsvps.length === 0) return [];

  const eventIds = rsvps.map(r => r.eventId);

  // Batch-get events to check which are in the past
  const chunks: string[][] = [];
  for (let i = 0; i < eventIds.length; i += 100) {
    chunks.push(eventIds.slice(i, i + 100));
  }

  const eventResults = await Promise.all(
    chunks.map(chunk =>
      dynamoClient.send(
        new BatchGetCommand({
          RequestItems: {
            [TABLE_NAME]: {
              Keys: chunk.map(id => keyOfEntity(EventEntity, { id })),
            },
          },
        })
      )
    )
  );

  const now = new Date().toISOString();
  const pastEventIds = new Set<string>();
  const eventMap = new Map<string, Event>();

  for (const result of eventResults) {
    for (const item of (result.Responses?.[TABLE_NAME] ?? []) as Event[]) {
      if (item.startDateTime < now) {
        pastEventIds.add(item.id);
        eventMap.set(item.id, item);
      }
    }
  }

  if (pastEventIds.size === 0) return [];

  // Batch-get ConcertLogs for these events to find which have no log yet
  const logKeys = [...pastEventIds].map(eventId =>
    keyOfEntity(ConcertLogEntity, { userId, eventId })
  );

  const logChunks: (typeof logKeys)[] = [];
  for (let i = 0; i < logKeys.length; i += 100) {
    logChunks.push(logKeys.slice(i, i + 100));
  }

  const logResults = await Promise.all(
    logChunks.map(chunk =>
      dynamoClient.send(
        new BatchGetCommand({
          RequestItems: { [TABLE_NAME]: { Keys: chunk } },
        })
      )
    )
  );

  const loggedEventIds = new Set<string>();
  for (const result of logResults) {
    for (const item of (result.Responses?.[TABLE_NAME] ?? []) as Array<{ sk: string }>) {
      // ElectroDB writes the sort key lowercase, so the stripped prefix must match.
      const eventId = item.sk.replace('concert_log#', '');
      loggedEventIds.add(eventId);
    }
  }

  const unloggedEvents = [...pastEventIds]
    .filter(id => !loggedEventIds.has(id))
    .map(id => eventMap.get(id))
    .filter((e): e is Event => !!e)
    .sort((a, b) => b.startDateTime.localeCompare(a.startDateTime))
    .slice(0, limit);

  return unloggedEvents;
}

export type { ConcertLog } from './entity';
