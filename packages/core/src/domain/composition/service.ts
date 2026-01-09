import { ApplicationError } from '../../types/common';
import { ErrorCode } from '../../constants';
import { CompositionRepository } from './repository';
import type { CreateCompositionInput, UpdateCompositionInput, Composition } from './schema';
import type { CompositionSearchParams, CompositionSearchResult } from './types';

/**
 * Service layer for composition business logic
 * Handles validation, business rules, and data enrichment
 */
/* eslint-disable @typescript-eslint/no-extraneous-class */
export class CompositionService {
  /**
   * Create a new composition with business logic validation
   */
  static async create(input: CreateCompositionInput): Promise<Composition> {
    // Business logic: Validate that required fields are present for carnatic compositions
    if (input.tradition === 'carnatic' && !input.language) {
      throw new ApplicationError(
        ErrorCode.GENERAL_VALIDATION_ERROR,
        'Language is required for carnatic compositions'
      );
    }

    // Business logic: Ensure title uniqueness (basic check)
    const existing = await CompositionRepository.search({
      query: input.title,
      limit: 1,
    });

    if (existing.items.some(item => item.title.toLowerCase() === input.title.toLowerCase())) {
      throw new ApplicationError(
        ErrorCode.COMPOSITION_ALREADY_EXISTS,
        `Composition with title "${input.title}" already exists`
      );
    }

    return CompositionRepository.create(input);
  }

  /**
   * Get composition by ID
   */
  static async getById(id: string): Promise<Composition | null> {
    return CompositionRepository.getById(id);
  }

  /**
   * Update composition with business logic
   */
  static async update(id: string, input: UpdateCompositionInput): Promise<Composition> {
    const existing = await CompositionRepository.getById(id);
    if (!existing) {
      throw new ApplicationError(
        ErrorCode.COMPOSITION_NOT_FOUND,
        `Composition with ID ${id} not found`
      );
    }

    // Business logic: Prevent changing tradition if attributions exist
    if (input.tradition && input.tradition !== existing.tradition) {
      const attributions = await CompositionRepository.getAttributionsByCompositionId(id);
      if (attributions.items.length > 0) {
        throw new ApplicationError(
          ErrorCode.GENERAL_VALIDATION_ERROR,
          'Cannot change tradition when composition has artist attributions'
        );
      }
    }

    return CompositionRepository.update(id, input);
  }

  /**
   * Search compositions with enhanced business logic
   */
  static async search(params: CompositionSearchParams): Promise<CompositionSearchResult> {
    return CompositionRepository.search(params);
  }

  /**
   * Get popular compositions
   */
  static async getPopular(limit = 10): Promise<Composition[]> {
    return CompositionRepository.getPopular(limit);
  }

  /**
   * Get composition by source URL
   */
  static async getBySourceUrl(sourceUrl: string): Promise<Composition | null> {
    return CompositionRepository.getBySourceUrl(sourceUrl);
  }

  /**
   * Increment view count for a composition
   */
  static async incrementViewCount(id: string): Promise<void> {
    return CompositionRepository.incrementViewCount(id);
  }
}
