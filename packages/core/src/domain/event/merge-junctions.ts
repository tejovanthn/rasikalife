import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { TABLE_NAME, dynamoClient } from '../../db/client';
import { keyOfEntity } from '../../db/keys';
import { ConcertLogEntity } from '../concert-log/entity';
import type { ConcertLog } from '../concert-log/entity';
import { RsvpEntity } from '../rsvp/entity';
import type { Rsvp } from '../rsvp/entity';
import { EventEntity } from './entity';

/**
 * The per-user rows a merged event leaves behind. Both are keyed on the event id, so a row cannot
 * be patched across: it is written under the keeper and deleted from the loser. A user who holds
 * a row on both keeps the keeper's, and counts are adjusted by what actually moved.
 */

async function addToCounter(
  eventId: string,
  attribute: 'rsvpCount' | 'attendedCount',
  delta: number
): Promise<void> {
  if (delta === 0) return;
  await dynamoClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: keyOfEntity(EventEntity, { id: eventId }),
      UpdateExpression: `ADD ${attribute} :delta`,
      ExpressionAttributeValues: { ':delta': delta },
    })
  );
}

export async function moveRsvps(loserId: string, canonicalId: string): Promise<number> {
  let moved = 0;
  let cursor: string | null = null;
  do {
    const page: { data?: Rsvp[]; cursor?: string | null } = await RsvpEntity.query
      .byEvent({ eventId: loserId })
      .go({ limit: 100, cursor: cursor ?? undefined });
    for (const row of page.data ?? []) {
      const has = await RsvpEntity.get({ eventId: canonicalId, userId: row.userId }).go();
      if (!has.data) {
        await RsvpEntity.create({
          eventId: canonicalId,
          userId: row.userId,
          createdAt: row.createdAt,
        }).go();
        moved++;
      }
      await RsvpEntity.delete({ eventId: loserId, userId: row.userId }).go();
    }
    cursor = page.cursor ?? null;
  } while (cursor);
  await addToCounter(canonicalId, 'rsvpCount', moved);
  return moved;
}

export async function moveConcertLogs(
  loserId: string,
  canonicalId: string,
  canonical: { title: string; startDateTime: string; venueName?: string }
): Promise<number> {
  let moved = 0;
  let cursor: string | null = null;
  do {
    const page: { data?: ConcertLog[]; cursor?: string | null } = await ConcertLogEntity.query
      .byEvent({ eventId: loserId })
      .go({ limit: 100, cursor: cursor ?? undefined });
    for (const row of page.data ?? []) {
      const has = await ConcertLogEntity.get({ userId: row.userId, eventId: canonicalId }).go();
      if (!has.data) {
        await ConcertLogEntity.create({
          userId: row.userId,
          eventId: canonicalId,
          eventTitle: canonical.title,
          eventStartDateTime: canonical.startDateTime,
          venueName: canonical.venueName,
          artistNames: row.artistNames,
          notes: row.notes,
          createdAt: row.createdAt,
        }).go();
        moved++;
      }
      await ConcertLogEntity.delete({ userId: row.userId, eventId: loserId }).go();
    }
    cursor = page.cursor ?? null;
  } while (cursor);
  await addToCounter(canonicalId, 'attendedCount', moved);
  return moved;
}
