import { createQuery } from '@/db';
import { ArtistRepository } from './repository';
import type { CreateArtistInput, Artist, UpdateArtistInput } from './schema';
import type { ArtistDynamoItem, ArtistSearchParams, ArtistSearchResult } from './types';

export class ArtistService {
  static async createArtist(input: CreateArtistInput): Promise<Artist> {
    // Add any business logic here (e.g., validation, enrichment)
    return ArtistRepository.create(input);
  }

  static async getArtist(id: string): Promise<Artist | null> {
    return ArtistRepository.getById(id);
  }

  static async updateArtist(id: string, input: UpdateArtistInput): Promise<Artist> {
    // Verify artist exists
    const existing = await ArtistService.getArtist(id);
    if (!existing) {
      throw new Error(`Artist ${id} not found`);
    }

    return ArtistRepository.update(id, input);
  }

  static async searchArtists(params: ArtistSearchParams): Promise<ArtistSearchResult> {
    return ArtistRepository.search(params);
  }

  static async getPopularArtists(limit = 10): Promise<Artist[]> {
    // Using popularity score GSI
    const result = await createQuery<ArtistDynamoItem>()
      .withIndex('GSI3')
      .withPartitionKey('GSI3PK', 'POPULARITY')
      .withSortOrder(false) // Descending
      .withLimit(limit)
      .execute();

    return result.items;
  }

  static async incrementViewCount(id: string): Promise<void> {
    await ArtistRepository.update(id, {
      viewCount: { $increment: 1 },
      // We'd also update popularity score here based on your algorithm
    });
  }
}
