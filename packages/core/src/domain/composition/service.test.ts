// src/domain/composition/service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CompositionService } from './service';
import { CompositionRepository } from './repository';
import type { CreateCompositionInput, UpdateCompositionInput } from './schema';
import { Tradition } from '../artist';
import { AttributionType, AttributionConfidence } from './types';

// Mock the repository
vi.mock('./repository');

describe('CompositionService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('createComposition', () => {
    it('should normalize title and language during creation', async () => {
      const input: CreateCompositionInput = {
        title: ' vathapi ganapathim ', // Extra spaces
        language: 'sanskrit',
        tradition: Tradition.CARNATIC,
        editorId: 'user-123',
      };

      const mockComposition = {
        id: 'test-id',
        title: 'vathapi ganapathim',
        language: 'Sanskrit',
        tradition: Tradition.CARNATIC,
        version: 'v1',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
        addedBy: 'user-123',
        editedBy: ['user-123'],
        viewCount: 0,
        favoriteCount: 0,
        popularityScore: 0,
        isLatest: true,
      };

      vi.mocked(CompositionRepository.create).mockResolvedValue(mockComposition);

      const result = await CompositionService.createComposition(input);

      // Check that title and language were normalized
      expect(CompositionRepository.create).toHaveBeenCalledWith({
        ...input,
        title: 'vathapi ganapathim',
        language: 'Sanskrit',
      });

      expect(result).toEqual(mockComposition);
    });
  });

  describe('getCompositionWithAttributions', () => {
    it('should call repository method to get composition with attributions', async () => {
      const mockResult = {
        id: 'test-id',
        title: 'Test Composition',
        attributions: [
          {
            compositionId: 'test-id',
            artistId: 'artist-123',
            attributionType: AttributionType.PRIMARY,
            confidence: AttributionConfidence.HIGH,
            addedBy: 'user-123',
            createdAt: '2023-01-01T00:00:00.000Z',
            verifiedBy: [],
          },
        ],
      };

      vi.mocked(CompositionRepository.getWithAttributions).mockResolvedValue(mockResult);

      const result = await CompositionService.getCompositionWithAttributions('test-id');

      expect(CompositionRepository.getWithAttributions).toHaveBeenCalledWith('test-id');
      expect(result).toEqual(mockResult);
    });
  });

  describe('searchCompositions', () => {
    it('should search by title if query provided', async () => {
      vi.mocked(CompositionRepository.searchByTitle).mockResolvedValue({
        items: [{ id: 'test-id', title: 'Test Composition' } as any],
        hasMore: false,
      });

      const result = await CompositionService.searchCompositions({ query: 'test' });

      expect(CompositionRepository.searchByTitle).toHaveBeenCalledWith('test', undefined);
      expect(result.items[0].title).toBe('Test Composition');
    });

    it('should search by tradition if provided', async () => {
      vi.mocked(CompositionRepository.getByTradition).mockResolvedValue({
        items: [{ id: 'test-id', title: 'Carnatic Composition' } as any],
        hasMore: false,
      });

      const result = await CompositionService.searchCompositions({ tradition: Tradition.CARNATIC });

      expect(CompositionRepository.getByTradition).toHaveBeenCalledWith(
        Tradition.CARNATIC,
        undefined,
        undefined
      );
      expect(result.items[0].title).toBe('Carnatic Composition');
    });

    it('should search by language with normalization if provided', async () => {
      vi.mocked(CompositionRepository.getByLanguage).mockResolvedValue({
        items: [{ id: 'test-id', title: 'Sanskrit Composition' } as any],
        hasMore: false,
      });

      const result = await CompositionService.searchCompositions({ language: 'sanskrit' });

      expect(CompositionRepository.getByLanguage).toHaveBeenCalledWith(
        'Sanskrit',
        undefined,
        undefined
      );
      expect(result.items[0].title).toBe('Sanskrit Composition');
    });

    it('should search by artistId if provided', async () => {
      vi.mocked(CompositionRepository.getCompositionsByArtistId).mockResolvedValue({
        items: [
          { compositionId: 'comp-1', artistId: 'artist-123' },
          { compositionId: 'comp-2', artistId: 'artist-123' },
        ] as any,
        hasMore: false,
      });

      vi.mocked(CompositionRepository.getById)
        .mockResolvedValueOnce({ id: 'comp-1', title: 'Composition 1' } as any)
        .mockResolvedValueOnce({ id: 'comp-2', title: 'Composition 2' } as any);

      const result = await CompositionService.searchCompositions({ artistId: 'artist-123' });

      expect(CompositionRepository.getCompositionsByArtistId).toHaveBeenCalledWith(
        'artist-123',
        undefined,
        undefined
      );
      expect(result.items).toHaveLength(2);
      expect(result.items[0].title).toBe('Composition 1');
      expect(result.items[1].title).toBe('Composition 2');
    });
  });

  describe('searchAttributions', () => {
    it('should search attributions by compositionId if provided', async () => {
      vi.mocked(CompositionRepository.getAttributionsByCompositionId).mockResolvedValue({
        items: [
          { compositionId: 'comp-123', artistId: 'artist-456' },
          { compositionId: 'comp-123', artistId: 'artist-789' },
        ] as any,
        hasMore: false,
      });

      const result = await CompositionService.searchAttributions({ compositionId: 'comp-123' });

      expect(CompositionRepository.getAttributionsByCompositionId).toHaveBeenCalledWith('comp-123');
      expect(result.items).toHaveLength(2);
      expect(result.items[0].compositionId).toBe('comp-123');
      expect(result.items[1].compositionId).toBe('comp-123');
    });

    it('should search attributions by artistId if provided', async () => {
      vi.mocked(CompositionRepository.getCompositionsByArtistId).mockResolvedValue({
        items: [
          { compositionId: 'comp-123', artistId: 'artist-456' },
          { compositionId: 'comp-789', artistId: 'artist-456' },
        ] as any,
        hasMore: false,
      });

      const result = await CompositionService.searchAttributions({ artistId: 'artist-456' });

      expect(CompositionRepository.getCompositionsByArtistId).toHaveBeenCalledWith(
        'artist-456',
        undefined,
        undefined
      );
      expect(result.items).toHaveLength(2);
      expect(result.items[0].artistId).toBe('artist-456');
      expect(result.items[1].artistId).toBe('artist-456');
    });

    it('should search disputed attributions if type is disputed', async () => {
      vi.mocked(CompositionRepository.getDisputedAttributions).mockResolvedValue({
        items: [
          {
            compositionId: 'comp-123',
            artistId: 'artist-456',
            attributionType: AttributionType.DISPUTED,
          },
          {
            compositionId: 'comp-789',
            artistId: 'artist-101',
            attributionType: AttributionType.DISPUTED,
          },
        ] as any,
        hasMore: false,
      });

      const result = await CompositionService.searchAttributions({ attributionType: 'disputed' });

      expect(CompositionRepository.getDisputedAttributions).toHaveBeenCalledWith(
        undefined,
        undefined
      );
      expect(result.items).toHaveLength(2);
      expect(result.items[0].attributionType).toBe(AttributionType.DISPUTED);
      expect(result.items[1].attributionType).toBe(AttributionType.DISPUTED);
    });
  });

  describe('normalizeLanguage', () => {
    it('should normalize known languages', async () => {
      // Test by calling updateComposition which uses it internally
      const updateInput: UpdateCompositionInput = {
        language: 'telugu',
        editorId: 'user-123',
      };

      vi.mocked(CompositionRepository.update).mockResolvedValue({} as any);

      await CompositionService.updateComposition('test-id', updateInput);

      // Check that language was normalized
      expect(CompositionRepository.update).toHaveBeenCalledWith('test-id', {
        language: 'Telugu',
        editorId: 'user-123',
      });
    });

    it('should capitalize unknown languages', async () => {
      const updateInput: UpdateCompositionInput = {
        language: 'unknown',
        editorId: 'user-123',
      };

      vi.mocked(CompositionRepository.update).mockResolvedValue({} as any);

      await CompositionService.updateComposition('test-id', updateInput);

      // Check that language was normalized
      expect(CompositionRepository.update).toHaveBeenCalledWith('test-id', {
        language: 'Unknown',
        editorId: 'user-123',
      });
    });
  });
});
