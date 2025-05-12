import { RagaRepository } from './repository';
import type { CreateRagaInput, Raga, UpdateRagaInput } from './schema';
import type { RagaSearchParams, RagaSearchResult, RagaVersion } from './types';

export class RagaService {
  static async createRaga(input: CreateRagaInput): Promise<Raga> {
    // Normalize the raga name
    const normalizedInput = {
      ...input,
      name: RagaService.normalizeRagaName(input.name),
    };

    return RagaRepository.create(normalizedInput);
  }

  static async getRaga(id: string, version?: string): Promise<Raga | null> {
    return RagaRepository.getById(id, version);
  }

  static async getRagaByName(name: string): Promise<Raga | null> {
    // Try to find with original casing
    let raga = await RagaRepository.getByName(name);

    // If not found, try with normalized name
    if (!raga) {
      raga = await RagaRepository.getByName(RagaService.normalizeRagaName(name));
    }

    return raga;
  }

  static async updateRaga(id: string, input: UpdateRagaInput): Promise<Raga> {
    // Normalize the raga name if provided
    const normalizedInput = {
      ...input,
      ...(input.name ? { name: RagaService.normalizeRagaName(input.name) } : {}),
    };

    return RagaRepository.update(id, normalizedInput);
  }

  static async searchRagas(params: RagaSearchParams): Promise<RagaSearchResult> {
    if (params.query) {
      return RagaRepository.search(params.query, params.limit);
    }

    if (params.melakarta) {
      return RagaRepository.getByMelakarta(params.melakarta, params.limit, params.nextToken);
    }

    if (params.tradition) {
      return RagaRepository.getByTradition(params.tradition, params.limit, params.nextToken);
    }

    // Return empty results if no search criteria
    return { items: [], hasMore: false };
  }

  static async getVersionHistory(id: string): Promise<RagaVersion[]> {
    return RagaRepository.getVersionHistory(id);
  }

  static async incrementViewCount(id: string): Promise<void> {
    return RagaRepository.incrementViewCount(id);
  }

  // Helper function to normalize raga names
  private static normalizeRagaName(name: string): string {
    // Add any normalization logic here, such as:
    // - Capitalizing first letters
    // - Standard formatting for Carnatic ragas

    // Simple example:
    const words = name.split(' ');
    return words.map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
  }
}
