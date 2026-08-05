import type { z } from 'zod';
import { generateId } from '../../utils';
import { cascadeVenueMerge, cascadeVenueNameUpdate } from '../cascade';
import { createFailedError, notFoundError } from '../helpers';
import { VenueEntity } from './entity';
import type { Venue } from './entity';
import type { CreateVenueSchema, UpdateVenueSchema } from './schema';

export type CreateVenueInput = z.infer<typeof CreateVenueSchema>;
export type UpdateVenueInput = z.infer<typeof UpdateVenueSchema>;

export async function createVenue(input: CreateVenueInput): Promise<Venue> {
  const id = generateId();
  const result = await VenueEntity.create({
    id,
    ...input,
    city: input.address?.city,
  }).go();

  if (!result.data) {
    throw createFailedError('venue', input.name);
  }

  return result.data as Venue;
}

export async function getVenue(id: string): Promise<Venue | null> {
  const result = await VenueEntity.get({ id }).go();

  if (!result.data) {
    return null;
  }

  if (result.data.deletedAt && !result.data.mergedIntoId) {
    return null;
  }

  return result.data as Venue;
}

export async function getVenueByName(name: string): Promise<Venue | null> {
  const result = await VenueEntity.query.byName({ name }).go();
  const venue = result.data?.[0];
  if (!venue) return null;
  if (venue.deletedAt && !venue.mergedIntoId) return null;
  if (venue.mergedIntoId) return getVenue(venue.mergedIntoId);
  return venue as Venue;
}

export async function updateVenue(id: string, input: UpdateVenueInput): Promise<Venue> {
  const current = await getVenue(id);

  const updateData = input.address?.city ? { ...input, city: input.address.city } : input;
  const result = await VenueEntity.update({ id }).set(updateData).go({ response: 'all_new' });

  if (!result.data) {
    throw notFoundError('venue', id);
  }

  if (input.name && current && input.name !== current.name) {
    await cascadeVenueNameUpdate(id, input.name);
  }

  return result.data as Venue;
}

export async function deleteVenue(id: string): Promise<void> {
  await VenueEntity.delete({ id }).go();
}

export async function softDeleteVenue(id: string): Promise<void> {
  await VenueEntity.update({ id }).set({ deletedAt: new Date().toISOString() }).go();
}

export async function listVenues(params?: { limit?: number; nextToken?: string }): Promise<{
  items: Venue[];
  nextToken?: string;
  hasMore: boolean;
}> {
  const limit = params?.limit || 20;

  const result = await VenueEntity.query
    .list({})
    .where((attr, op) => op.notExists(attr.deletedAt))
    .go({
      limit,
      cursor: params?.nextToken,
    });

  return {
    items: result.data || [],
    nextToken: result.cursor || undefined,
    hasMore: !!result.cursor,
  };
}

export async function listVenuesByCity(
  city: string,
  params?: { limit?: number; nextToken?: string }
): Promise<{
  items: Venue[];
  nextToken?: string;
  hasMore: boolean;
}> {
  const limit = params?.limit || 20;

  const result = await VenueEntity.query
    .byCity({ city })
    .where((attr, op) => op.notExists(attr.deletedAt))
    .go({
      limit,
      cursor: params?.nextToken,
    });

  return {
    items: result.data || [],
    nextToken: result.cursor || undefined,
    hasMore: !!result.cursor,
  };
}

export async function mergeVenue(loserId: string, canonicalId: string): Promise<void> {
  const canonical = await getVenue(canonicalId);
  if (!canonical) throw notFoundError('venue', canonicalId);
  const loser = await VenueEntity.get({ id: loserId }).go();
  if (!loser.data) throw notFoundError('venue', loserId);

  await cascadeVenueMerge(loserId, canonicalId, canonical.name);
  await VenueEntity.update({ id: loserId })
    .set({ deletedAt: new Date().toISOString(), mergedIntoId: canonicalId })
    .go();

  const loserName = loser.data.name;
  const existing = (canonical.alternateNames || []) as string[];
  if (!existing.includes(loserName)) {
    await VenueEntity.update({ id: canonicalId })
      .set({ alternateNames: [...existing, loserName] })
      .go();
  }
}

export async function getVenueMergeScore(id: string): Promise<number> {
  const { EventEntity } = await import('../event/entity');

  const [eventResult, venue] = await Promise.all([
    EventEntity.query.byVenue({ venueId: id }).go({ attributes: ['id'] as never[] }),
    VenueEntity.get({ id }).go(),
  ]);

  let score = (eventResult.data || []).length;
  if (venue.data) {
    if (venue.data.address?.street) score += 1;
    if (venue.data.address?.city) score += 1;
    if (venue.data.address?.state) score += 1;
    if (venue.data.mapLink) score += 1;
  }
  return score;
}

export type { Venue } from './entity';
export { CreateVenueSchema, UpdateVenueSchema } from './schema';
export { isNonPlaceVenueName, venueTypeFromName } from './enrich';
