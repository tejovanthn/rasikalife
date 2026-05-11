import { RsvpEntity } from './entity';

export async function toggleRsvp(
  eventId: string,
  userId: string
): Promise<{ isGoing: boolean; count: number }> {
  const existing = await RsvpEntity.get({ eventId, userId }).go();

  if (existing.data) {
    await RsvpEntity.delete({ eventId, userId }).go();
    const count = await getRsvpCount(eventId);
    return { isGoing: false, count };
  }

  await RsvpEntity.create({ eventId, userId }).go();
  const count = await getRsvpCount(eventId);
  return { isGoing: true, count };
}

export async function getRsvpCount(eventId: string): Promise<number> {
  const result = await RsvpEntity.query.byEvent({ eventId }).go({ pages: 'all' });
  return result.data.length;
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
