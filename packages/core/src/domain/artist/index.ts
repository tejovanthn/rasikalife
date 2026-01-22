import type { z } from 'zod';
import { generateId } from '../../utils';
import { ApplicationError, ErrorCode } from '../constants';
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
    throw new ApplicationError(
      ErrorCode.ARTIST_CREATE_FAILED,
      `Failed to create artist: ${input.name}`
    );
  }

  return result.data as Artist;
}

export async function getArtist(id: string): Promise<Artist> {
  const result = await ArtistEntity.get({ id }).go();

  if (!result.data) {
    throw new ApplicationError(ErrorCode.ARTIST_NOT_FOUND, `Artist with ID ${id} not found`);
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
    throw new ApplicationError(ErrorCode.ARTIST_NOT_FOUND, `Artist with ID ${id} not found`);
  }

  return result.data as Artist;
}

export async function deleteArtist(id: string): Promise<void> {
  await ArtistEntity.delete({ id }).go();
}

export async function listArtists(params?: { limit?: number; nextToken?: string }): Promise<{
  items: Artist[];
  nextToken?: string;
  hasMore: boolean;
}> {
  const limit = params?.limit || 20;

  // Query the list index for efficient sorted retrieval (PK = ARTIST_LIST, results sorted by SK = name#id)
  const result = await ArtistEntity.query.list({}).go({
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
