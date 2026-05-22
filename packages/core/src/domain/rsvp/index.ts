import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { TABLE_NAME, dynamoClient } from '../../db/client';
import { EventEntity } from '../event/entity';
import { RsvpEntity } from './entity';

async function adjustRsvpCounter(eventId: string, delta: 1 | -1): Promise<number> {
  const result = await dynamoClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { pk: `EVENT#${eventId}`, sk: '#METADATA' },
      UpdateExpression: 'ADD rsvpCount :delta',
      ExpressionAttributeValues: { ':delta': delta },
      ReturnValues: 'UPDATED_NEW',
    })
  );
  return (result.Attributes?.rsvpCount as number) ?? 0;
}

export async function toggleRsvp(
  eventId: string,
  userId: string
): Promise<{ isGoing: boolean; count: number }> {
  const existing = await RsvpEntity.get({ eventId, userId }).go();

  if (existing.data) {
    const [, count] = await Promise.all([
      RsvpEntity.delete({ eventId, userId }).go(),
      adjustRsvpCounter(eventId, -1),
    ]);
    return { isGoing: false, count };
  }

  const [, count] = await Promise.all([
    RsvpEntity.create({ eventId, userId }).go(),
    adjustRsvpCounter(eventId, 1),
  ]);
  return { isGoing: true, count };
}

export async function getRsvpCount(eventId: string): Promise<number> {
  const result = await EventEntity.get({ id: eventId }).go();
  return result.data?.rsvpCount ?? 0;
}

export async function getUserRsvp(eventId: string, userId: string): Promise<boolean> {
  const result = await RsvpEntity.get({ eventId, userId }).go();
  return !!result.data;
}

export async function getEventRsvpInfo(
  eventId: string,
  userId?: string
): Promise<{ count: number; isGoing: boolean }> {
  const [count, isGoing] = await Promise.all([
    getRsvpCount(eventId),
    userId ? getUserRsvp(eventId, userId) : Promise.resolve(false),
  ]);
  return { count, isGoing };
}
