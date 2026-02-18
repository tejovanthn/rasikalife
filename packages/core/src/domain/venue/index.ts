import type { z } from 'zod';
import { generateId } from '../../utils';
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

  return result.data as Venue;
}

export async function getVenueByName(name: string): Promise<Venue | null> {
  const result = await VenueEntity.query.byName({ name }).go();
  return result.data?.[0] || null;
}

export async function updateVenue(id: string, input: UpdateVenueInput): Promise<Venue> {
  const updateData = input.address?.city ? { ...input, city: input.address.city } : input;
  const result = await VenueEntity.update({ id }).set(updateData).go();

  if (!result.data) {
    throw notFoundError('venue', id);
  }

  return result.data as Venue;
}

export async function deleteVenue(id: string): Promise<void> {
  await VenueEntity.delete({ id }).go();
}

export async function listVenues(params?: { limit?: number; nextToken?: string }): Promise<{
  items: Venue[];
  nextToken?: string;
  hasMore: boolean;
}> {
  const limit = params?.limit || 20;

  const result = await VenueEntity.query.list({}).go({
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

  const result = await VenueEntity.query.byCity({ city }).go({
    limit,
    cursor: params?.nextToken,
  });

  return {
    items: result.data || [],
    nextToken: result.cursor || undefined,
    hasMore: !!result.cursor,
  };
}

export type { Venue } from './entity';
export { CreateVenueSchema, UpdateVenueSchema } from './schema';
