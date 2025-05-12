import { TalaRepository } from './repository';
import type { CreateTalaInput, Tala, UpdateTalaInput } from './schema';
import type { TalaSearchParams, TalaSearchResult, TalaVersion } from './types';

export class TalaService {
  static async createTala(input: CreateTalaInput): Promise<Tala> {
    // Normalize the tala name
    const normalizedInput = {
      ...input,
      name: TalaService.normalizeTalaName(input.name),
    };

    return TalaRepository.create(normalizedInput);
  }

  static async getTala(id: string, version?: string): Promise<Tala | null> {
    return TalaRepository.getById(id, version);
  }

  static async getTalaByName(name: string): Promise<Tala | null> {
    // Try to find with original casing
    let tala = await TalaRepository.getByName(name);

    // If not found, try with normalized name
    if (!tala) {
      tala = await TalaRepository.getByName(TalaService.normalizeTalaName(name));
    }

    return tala;
  }

  static async updateTala(id: string, input: UpdateTalaInput): Promise<Tala> {
    // Normalize the tala name if provided
    const normalizedInput = {
      ...input,
      ...(input.name ? { name: TalaService.normalizeTalaName(input.name) } : {}),
      ...(input.type ? { type: TalaService.normalizeType(input.type) } : {}),
    };

    return TalaRepository.update(id, normalizedInput);
  }

  static async searchTalas(params: TalaSearchParams): Promise<TalaSearchResult> {
    if (params.query) {
      return TalaRepository.search(params.query, params.limit);
    }

    if (params.aksharas) {
      return TalaRepository.getByAksharas(params.aksharas, params.limit, params.nextToken);
    }

    if (params.type) {
      return TalaRepository.getByType(
        TalaService.normalizeType(params.type),
        params.limit,
        params.nextToken
      );
    }

    if (params.tradition) {
      return TalaRepository.getByTradition(params.tradition, params.limit, params.nextToken);
    }

    // Return empty results if no search criteria
    return { items: [], hasMore: false };
  }

  static async getVersionHistory(id: string): Promise<TalaVersion[]> {
    return TalaRepository.getVersionHistory(id);
  }

  static async incrementViewCount(id: string): Promise<void> {
    return TalaRepository.incrementViewCount(id);
  }

  // Helper function to normalize tala names
  private static normalizeTalaName(name: string): string {
    // Capitalize first letter of each word
    const words = name.split(' ');
    return words.map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
  }

  // Helper function to normalize tala types
  private static normalizeType(type: string): string {
    // Common tala types in Carnatic music (suladi, chapu, etc.)
    // Can be expanded for more types
    const typeMap: Record<string, string> = {
      suladi: 'Suladi',
      sapta: 'Sapta',
      chapu: 'Chapu',
      jati: 'Jati',
      misra: 'Misra',
      khanda: 'Khanda',
      tisra: 'Tisra',
      chatusra: 'Chatusra',
      sankeerna: 'Sankeerna',
    };

    const lowerType = type.toLowerCase();
    console.log(lowerType);

    // Return standardized type if known
    for (const [key, value] of Object.entries(typeMap)) {
      if (lowerType.includes(key)) {
        return value;
      }
    }

    // Otherwise return with first letter capitalized
    return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
  }
}
