import { ApplicationError, ErrorCode } from '@rasika/core';
import type { z } from 'zod';
import { generateId } from '../../utils';
import { cascadeComposerNameUpdate } from '../cascade';
import { createFailedError, notFoundError } from '../helpers';
import { ArtistEntity } from './entity';
import type { Artist } from './entity';
import type { CreateArtistSchema, UpdateArtistSchema } from './schema';

export type CreateArtistInput = z.infer<typeof CreateArtistSchema>;
export type UpdateArtistInput = z.infer<typeof UpdateArtistSchema>;

export async function createArtist(input: CreateArtistInput): Promise<Artist> {
  const id = generateId();
  const result = await ArtistEntity.create({
    id,
    ...input,
  }).go();

  if (!result.data) {
    throw createFailedError('artist', input.name);
  }

  return result.data as Artist;
}

export async function getArtist(id: string): Promise<Artist | null> {
  const result = await ArtistEntity.get({ id }).go();

  if (!result.data) {
    return null;
  }

  if (result.data.deletedAt) {
    return null;
  }

  return result.data as Artist;
}

export async function getArtistByName(name: string): Promise<Artist | null> {
  const result = await ArtistEntity.query.byName({ name }).go();
  return result.data?.[0] || null;
}

export async function updateArtist(id: string, input: UpdateArtistInput): Promise<Artist> {
  const result = await ArtistEntity.update({ id }).set(input).go();

  if (!result.data) {
    throw notFoundError('artist', id);
  }

  if (input.name) {
    await cascadeComposerNameUpdate(id, input.name);
  }

  return result.data as Artist;
}

export async function deleteArtist(id: string): Promise<void> {
  await ArtistEntity.delete({ id }).go();
}

export async function softDeleteArtist(id: string): Promise<void> {
  await ArtistEntity.update({ id }).set({ deletedAt: new Date().toISOString() }).go();
}

export async function listArtists(params?: { limit?: number; nextToken?: string }): Promise<{
  items: Artist[];
  nextToken?: string;
  hasMore: boolean;
}> {
  const limit = params?.limit || 20;

  const result = await ArtistEntity.query
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

export type { Artist } from './entity';
export { CreateArtistSchema, UpdateArtistSchema } from './schema';
