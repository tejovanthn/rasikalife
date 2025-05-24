// ../../domain/composition/service.ts
import { CompositionRepository } from './repository';
import type {
  CreateCompositionInput,
  UpdateCompositionInput,
  Composition,
  CreateAttributionInput,
  UpdateAttributionInput,
  CompositionAttribution,
} from './schema';
import type {
  CompositionSearchParams,
  CompositionSearchResult,
  CompositionVersion,
  AttributionSearchParams,
  AttributionSearchResult,
  CompositionWithAttributions,
} from './types';

export class CompositionService {
  // Composition Methods
  static async createComposition(input: CreateCompositionInput): Promise<Composition> {
    // Normalize the composition title
    const normalizedInput = {
      ...input,
      title: CompositionService.normalizeTitle(input.title),
      language: CompositionService.normalizeLanguage(input.language),
    };

    return CompositionRepository.create(normalizedInput);
  }

  static async getComposition(id: string, version?: string): Promise<Composition | null> {
    return CompositionRepository.getById(id, version);
  }

  static async getCompositionWithAttributions(
    id: string
  ): Promise<CompositionWithAttributions | null> {
    return CompositionRepository.getWithAttributions(id);
  }

  static async updateComposition(id: string, input: UpdateCompositionInput): Promise<Composition> {
    // Normalize the title if provided
    const normalizedInput = {
      ...input,
      ...(input.title ? { title: CompositionService.normalizeTitle(input.title) } : {}),
      ...(input.language ? { language: CompositionService.normalizeLanguage(input.language) } : {}),
    };

    return CompositionRepository.update(id, normalizedInput);
  }

  static async getVersionHistory(id: string): Promise<CompositionVersion[]> {
    return CompositionRepository.getVersionHistory(id);
  }

  static async searchCompositions(
    params: CompositionSearchParams
  ): Promise<CompositionSearchResult> {
    if (params.query) {
      return CompositionRepository.searchByTitle(params.query, params.limit);
    }

    if (params.tradition) {
      return CompositionRepository.getByTradition(params.tradition, params.limit, params.nextToken);
    }

    if (params.language) {
      return CompositionRepository.getByLanguage(
        CompositionService.normalizeLanguage(params.language),
        params.limit,
        params.nextToken
      );
    }

    if (params.artistId) {
      // Get attributions
      const attributions = await CompositionRepository.getCompositionsByArtistId(
        params.artistId,
        params.limit,
        params.nextToken
      );

      // Get compositions for each attribution
      const compositions = await Promise.all(
        attributions.items.map(attr => CompositionService.getComposition(attr.compositionId))
      );

      // Filter out any null results
      const validCompositions = compositions.filter(Boolean) as Composition[];

      return {
        items: validCompositions,
        nextToken: attributions.nextToken,
        hasMore: attributions.hasMore,
      };
    }

    // Return empty results if no search criteria
    return { items: [], hasMore: false };
  }

  static async incrementViewCount(id: string): Promise<void> {
    return CompositionRepository.incrementViewCount(id);
  }

  // Attribution Methods
  static async createAttribution(input: CreateAttributionInput): Promise<CompositionAttribution> {
    return CompositionRepository.createAttribution(input);
  }

  static async updateAttribution(input: UpdateAttributionInput): Promise<CompositionAttribution> {
    return CompositionRepository.updateAttribution(input);
  }

  static async getAttribution(
    compositionId: string,
    artistId: string
  ): Promise<CompositionAttribution | null> {
    return CompositionRepository.getAttribution(compositionId, artistId);
  }

  static async searchAttributions(
    params: AttributionSearchParams
  ): Promise<AttributionSearchResult> {
    if (params.compositionId) {
      return CompositionRepository.getAttributionsByCompositionId(params.compositionId);
    }

    if (params.artistId) {
      return CompositionRepository.getCompositionsByArtistId(
        params.artistId,
        params.limit,
        params.nextToken
      );
    }

    if (params.attributionType === 'disputed') {
      return CompositionRepository.getDisputedAttributions(params.limit, params.nextToken);
    }

    // Return empty results if no search criteria
    return { items: [], hasMore: false };
  }

  static async verifyAttribution(
    compositionId: string,
    artistId: string,
    userId: string
  ): Promise<CompositionAttribution> {
    return CompositionRepository.verifyAttribution(compositionId, artistId, userId);
  }

  // Helper Methods
  private static normalizeTitle(title: string): string {
    return title.trim();
  }

  private static normalizeLanguage(language: string): string {
    // Common languages in Indian classical music
    const languageMap: Record<string, string> = {
      sanskrit: 'Sanskrit',
      tamil: 'Tamil',
      telugu: 'Telugu',
      kannada: 'Kannada',
      hindi: 'Hindi',
      urdu: 'Urdu',
      marathi: 'Marathi',
      gujarati: 'Gujarati',
      bengali: 'Bengali',
      punjabi: 'Punjabi',
      malayalam: 'Malayalam',
    };

    const lowerLanguage = language.toLowerCase();

    // Return standardized language if known
    if (languageMap[lowerLanguage]) {
      return languageMap[lowerLanguage];
    }

    // Otherwise return with first letter capitalized
    return language.charAt(0).toUpperCase() + language.slice(1).toLowerCase();
  }
}
