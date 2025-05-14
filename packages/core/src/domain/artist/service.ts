import { createQuery } from '@/db';
import { ArtistRepository } from './repository';
import type { CreateArtistInput, Artist, UpdateArtistInput } from './schema';
import type { ArtistDynamoItem, ArtistSearchParams, ArtistSearchResult } from './types';

export const createArtist = async (input: CreateArtistInput): Promise<Artist> => {
  // Add any business logic here (e.g., validation, enrichment)
  return ArtistRepository.create(input);
};

export const getArtist = async (id: string): Promise<Artist | null> => {
  return ArtistRepository.getById(id);
};

export const updateArtist = async (id: string, input: UpdateArtistInput): Promise<Artist> => {
  // Verify artist exists
  const existing = await getArtist(id);
  if (!existing) {
    throw new Error(`Artist ${id} not found`);
  }

  return ArtistRepository.update(id, input);
};

export const searchArtists = async (params: ArtistSearchParams): Promise<ArtistSearchResult> => {
  return ArtistRepository.search(params);
};

export const getPopularArtists = async (limit = 10): Promise<Artist[]> => {
  // Using popularity score GSI
  const result = await createQuery<ArtistDynamoItem>()
    .withIndex('GSI3')
    .withPartitionKey('GSI3PK', 'POPULARITY')
    .withSortOrder(false) // Descending
    .withLimit(limit)
    .execute();

  return result.items;
};

export const incrementViewCount = async (id: string): Promise<void> => {
  await ArtistRepository.update(id, {
    viewCount: { $increment: 1 },
    // We'd also update popularity score here based on your algorithm
  });
};
