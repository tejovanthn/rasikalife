import { vi, describe, beforeEach, it, expect } from 'vitest';
import * as dbModule from '../../db';
import * as accessPatternsModule from '../../shared/accessPatterns';
import * as singleTableModule from '../../shared/singleTable';
import { Tradition } from '../artist';
import { CompositionRepository } from './repository';
import type { CreateCompositionInput, CreateAttributionInput } from './schema';
import { AttributionType, AttributionConfidence } from './types';

// Mock DB functions
vi.mock('../../db');
vi.mock('../../shared/accessPatterns');
vi.mock('../../shared/singleTable');
vi.mock('../../utils', async () => {
  const originalModule = await vi.importActual('../../utils');

  return {
    ...originalModule,
    getCurrentISOString: () => '2023-01-01T00:00:00.000Z',
    generateId: () => 'test-id-123',
  };
});

describe('CompositionRepository', () => {
  // Reset mocks before each test
  beforeEach(() => {
    vi.resetAllMocks();

    // Mock implementations
    vi.mocked(singleTableModule.createBaseItem).mockResolvedValue({
      PK: 'COMPOSITION#test-id-123',
      SK: '#METADATA',
      id: 'test-id-123',
      createdAt: '2023-01-01T00:00:00.000Z',
      updatedAt: '2023-01-01T00:00:00.000Z',
    });

    vi.mocked(singleTableModule.formatKey).mockImplementation((prefix, id) => `${prefix}#${id}`);

    vi.mocked(singleTableModule.formatVersionKey).mockImplementation(
      (version, timestamp) => `VERSION#${version}${timestamp ? `#${timestamp}` : ''}`
    );

    vi.mocked(singleTableModule.formatIndexKey).mockImplementation(
      (prefix, value) => `${prefix}#${value}`
    );

    vi.mocked(dbModule.putItem).mockResolvedValue({});
    vi.mocked(dbModule.batchPutItems).mockResolvedValue();
    vi.mocked(dbModule.updateItem).mockResolvedValue({} as any);
  });

  describe('create', () => {
    it('should create a new composition with version v1', async () => {
      const input: CreateCompositionInput = {
        title: 'Vathapi Ganapathim',
        language: 'Sanskrit',
        tradition: Tradition.CARNATIC,
        ragaIds: ['raga-123'],
        talaIds: ['tala-456'],
        editorId: 'user-123',
      };

      await CompositionRepository.create(input);

      // Verify batch put items was called with both composition and latest pointer
      expect(dbModule.batchPutItems).toHaveBeenCalledTimes(1);
      const batchArgs = vi.mocked(dbModule.batchPutItems).mock.calls[0][0];

      // Should have 2 items (composition and latest pointer)
      expect(batchArgs).toHaveLength(2);

      // First item should be composition with correct fields
      expect(batchArgs[0]).toMatchObject({
        title: 'Vathapi Ganapathim',
        language: 'Sanskrit',
        tradition: Tradition.CARNATIC,
        ragaIds: ['raga-123'],
        talaIds: ['tala-456'],
        version: 'v1',
        addedBy: 'user-123',
        editedBy: ['user-123'],
        viewCount: 0,
        favoriteCount: 0,
        popularityScore: 0,
        isLatest: true,
        SK: 'VERSION#v1#2023-01-01T00:00:00.000Z',
      });

      // Second item should be latest pointer
      expect(batchArgs[1]).toMatchObject({
        PK: 'COMPOSITION#test-id-123',
        SK: 'VERSION#LATEST',
        version: 'v1',
        timestamp: '2023-01-01T00:00:00.000Z',
        isLatest: true,
      });
    });

    it('should create GSI entries for searching', async () => {
      const input: CreateCompositionInput = {
        title: 'Vathapi Ganapathim',
        language: 'Sanskrit',
        tradition: Tradition.CARNATIC,
        editorId: 'user-123',
      };

      await CompositionRepository.create(input);

      const batchArgs = vi.mocked(dbModule.batchPutItems).mock.calls[0][0];
      const compositionItem = batchArgs[0];

      // Check GSI entries
      expect(compositionItem.GSI1PK).toBe('TITLE#vathapi ganapathim');
      expect(compositionItem.GSI1SK).toBe('COMPOSITION#test-id-123');
      expect(compositionItem.GSI2PK).toBe('TRADITION#carnatic');
      expect(compositionItem.GSI2SK).toBe('COMPOSITION#test-id-123');
      expect(compositionItem.GSI3PK).toBe('LANGUAGE#sanskrit');
      expect(compositionItem.GSI3SK).toBe('COMPOSITION#test-id-123');
    });
  });

  describe('getById', () => {
    it('should get latest composition version if version not specified', async () => {
      // Mock latest pointer
      vi.mocked(accessPatternsModule.getByPrimaryKey).mockResolvedValueOnce({
        PK: 'COMPOSITION#test-id',
        SK: 'VERSION#LATEST',
        version: 'v2',
        timestamp: '2023-01-02T00:00:00.000Z',
      });

      // Mock actual composition item
      vi.mocked(accessPatternsModule.getByPrimaryKey).mockResolvedValueOnce({
        PK: 'COMPOSITION#test-id',
        SK: 'VERSION#v2#2023-01-02T00:00:00.000Z',
        id: 'test-id',
        title: 'Vathapi Ganapathim',
        language: 'Sanskrit',
        version: 'v2',
        tradition: Tradition.CARNATIC,
        addedBy: 'user-123',
        isLatest: true,
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-02T00:00:00.000Z',
        viewCount: 5,
        favoriteCount: 0,
        popularityScore: 0,
        editedBy: ['user-123', 'user-456'],
      });

      const composition = await CompositionRepository.getById('test-id');

      // Verify correct version was fetched
      expect(accessPatternsModule.getByPrimaryKey).toHaveBeenCalledTimes(2);
      expect(accessPatternsModule.getByPrimaryKey).toHaveBeenCalledWith(
        'COMPOSITION',
        'test-id',
        'VERSION#LATEST'
      );
      expect(accessPatternsModule.getByPrimaryKey).toHaveBeenCalledWith(
        'COMPOSITION',
        'test-id',
        'VERSION#v2#2023-01-02T00:00:00.000Z'
      );

      expect(composition).toMatchObject({
        id: 'test-id',
        title: 'Vathapi Ganapathim',
        language: 'Sanskrit',
        version: 'v2',
        tradition: Tradition.CARNATIC,
        viewCount: 5,
      });
    });

    it('should get specific composition version if version is specified', async () => {
      vi.mocked(accessPatternsModule.getByPrimaryKey).mockResolvedValueOnce({
        PK: 'COMPOSITION#test-id',
        SK: 'VERSION#v1#2023-01-01T00:00:00.000Z',
        id: 'test-id',
        title: 'Vathapi Ganapathim',
        language: 'Sanskrit',
        version: 'v1',
        tradition: Tradition.CARNATIC,
        addedBy: 'user-123',
        isLatest: false,
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
        viewCount: 3,
        favoriteCount: 0,
        popularityScore: 0,
        editedBy: ['user-123'],
      });

      const composition = await CompositionRepository.getById('test-id', 'v1');

      // Verify correct version was fetched directly
      expect(accessPatternsModule.getByPrimaryKey).toHaveBeenCalledTimes(1);
      expect(accessPatternsModule.getByPrimaryKey).toHaveBeenCalledWith(
        'COMPOSITION',
        'test-id',
        'VERSION#v1'
      );

      expect(composition).toMatchObject({
        id: 'test-id',
        title: 'Vathapi Ganapathim',
        language: 'Sanskrit',
        version: 'v1',
        tradition: Tradition.CARNATIC,
        viewCount: 3,
      });
    });

    it('should return null if composition not found', async () => {
      vi.mocked(accessPatternsModule.getByPrimaryKey).mockResolvedValue(null);

      const composition = await CompositionRepository.getById('nonexistent-id');

      expect(composition).toBeNull();
    });
  });

  describe('getWithAttributions', () => {
    it('should get composition with its attributions', async () => {
      // Mock composition
      vi.mocked(accessPatternsModule.getByPrimaryKey)
        .mockResolvedValueOnce({
          PK: 'COMPOSITION#test-id',
          SK: 'VERSION#LATEST',
          version: 'v1',
          timestamp: '2023-01-01T00:00:00.000Z',
        })
        .mockResolvedValueOnce({
          id: 'test-id',
          title: 'Vathapi Ganapathim',
          language: 'Sanskrit',
          version: 'v1',
          tradition: Tradition.CARNATIC,
          addedBy: 'user-123',
          isLatest: true,
          createdAt: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-01T00:00:00.000Z',
          viewCount: 5,
          favoriteCount: 0,
          popularityScore: 0,
          editedBy: ['user-123'],
        });

      // Mock attributions
      vi.mocked(accessPatternsModule.getAllByPartitionKey).mockResolvedValue({
        items: [
          {
            compositionId: 'test-id',
            artistId: 'artist-123',
            attributionType: AttributionType.PRIMARY,
            confidence: AttributionConfidence.HIGH,
            addedBy: 'user-123',
            createdAt: '2023-01-01T00:00:00.000Z',
            verifiedBy: ['user-456'],
          },
        ],
        lastEvaluatedKey: undefined,
      });

      const result = await CompositionRepository.getWithAttributions('test-id');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('test-id');
      expect(result?.title).toBe('Vathapi Ganapathim');
      expect(result?.attributions).toHaveLength(1);
      expect(result?.attributions[0].artistId).toBe('artist-123');
      expect(result?.attributions[0].attributionType).toBe(AttributionType.PRIMARY);
    });
  });

  describe('update', () => {
    it('should create a new version when updating', async () => {
      // Mock getting current composition
      vi.mocked(accessPatternsModule.getByPrimaryKey)
        .mockResolvedValueOnce({
          PK: 'COMPOSITION#test-id',
          SK: 'VERSION#LATEST',
          version: 'v1',
          timestamp: '2023-01-01T00:00:00.000Z',
        })
        .mockResolvedValueOnce({
          PK: 'COMPOSITION#test-id',
          SK: 'VERSION#v1#2023-01-01T00:00:00.000Z',
          id: 'test-id',
          title: 'Vathapi Ganapathim',
          language: 'Sanskrit',
          version: 'v1',
          tradition: Tradition.CARNATIC,
          addedBy: 'user-123',
          isLatest: true,
          createdAt: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-01T00:00:00.000Z',
          viewCount: 5,
          favoriteCount: 0,
          popularityScore: 0,
          editedBy: ['user-123'],
        });

      const updateInput = {
        verses: 'Added verses content',
        editorId: 'user-456',
      };

      await CompositionRepository.update('test-id', updateInput);

      // Should have created 3 items in batch (new version, latest pointer, old version update)
      expect(dbModule.batchPutItems).toHaveBeenCalledTimes(1);
      const batchArgs = vi.mocked(dbModule.batchPutItems).mock.calls[0][0];
      expect(batchArgs).toHaveLength(3);

      // First item should be new composition version with correct fields
      expect(batchArgs[0]).toMatchObject({
        id: 'test-id',
        title: 'Vathapi Ganapathim',
        language: 'Sanskrit',
        version: 'v2',
        verses: 'Added verses content',
        tradition: Tradition.CARNATIC,
        isLatest: true,
        viewCount: 5,
        editedBy: ['user-123', 'user-456'], // Both editors
        SK: 'VERSION#v2#2023-01-01T00:00:00.000Z',
      });

      // Second item should be updated latest pointer
      expect(batchArgs[1]).toMatchObject({
        PK: 'COMPOSITION#test-id',
        SK: 'VERSION#LATEST',
        version: 'v2',
        timestamp: '2023-01-01T00:00:00.000Z',
        isLatest: true,
      });

      // Third item should mark old version as not latest
      expect(batchArgs[2]).toMatchObject({
        PK: 'COMPOSITION#test-id',
        SK: 'VERSION#v1#2023-01-01T00:00:00.000Z',
        isLatest: false,
      });
    });

    it('should throw error if composition not found', async () => {
      vi.mocked(accessPatternsModule.getByPrimaryKey).mockResolvedValue(null);

      await expect(
        CompositionRepository.update('nonexistent-id', {
          editorId: 'user-123',
        })
      ).rejects.toThrow('Composition nonexistent-id not found');
    });
  });

  describe('incrementViewCount', () => {
    it('should increment the view count on the latest version', async () => {
      vi.mocked(accessPatternsModule.getByPrimaryKey).mockResolvedValue({
        PK: 'COMPOSITION#test-id',
        SK: 'VERSION#LATEST',
        version: 'v2',
        timestamp: '2023-01-02T00:00:00.000Z',
      });

      await CompositionRepository.incrementViewCount('test-id');

      expect(dbModule.updateItem).toHaveBeenCalledWith(
        {
          PK: 'COMPOSITION#test-id',
          SK: 'VERSION#v2#2023-01-02T00:00:00.000Z',
        },
        expect.objectContaining({
          viewCount: { $increment: 1 },
          popularityScore: { $add: 0.1 },
        })
      );
    });

    it('should do nothing if composition not found', async () => {
      vi.mocked(accessPatternsModule.getByPrimaryKey).mockResolvedValue(null);

      await CompositionRepository.incrementViewCount('nonexistent-id');

      expect(dbModule.updateItem).not.toHaveBeenCalled();
    });
  });

  describe('createAttribution', () => {
    it('should create a new attribution', async () => {
      const input: CreateAttributionInput = {
        compositionId: 'composition-123',
        artistId: 'artist-456',
        attributionType: AttributionType.PRIMARY,
        confidence: AttributionConfidence.HIGH,
        source: 'Historical records',
        addedBy: 'user-123',
      };

      await CompositionRepository.createAttribution(input);

      expect(dbModule.putItem).toHaveBeenCalledTimes(1);
      const itemArg = vi.mocked(dbModule.putItem).mock.calls[0][0];

      expect(itemArg).toMatchObject({
        PK: 'COMPOSITION#composition-123',
        SK: 'ATTRIBUTION#artist-456',
        GSI1PK: 'ARTIST#artist-456',
        GSI1SK: 'COMPOSES#composition-123',
        GSI2PK: 'ATTRIBUTION_TYPE#primary',
        GSI2SK: 'COMPOSITION#composition-123',
        compositionId: 'composition-123',
        artistId: 'artist-456',
        attributionType: AttributionType.PRIMARY,
        confidence: AttributionConfidence.HIGH,
        source: 'Historical records',
        addedBy: 'user-123',
        createdAt: '2023-01-01T00:00:00.000Z',
        verifiedBy: [],
      });
    });
  });

  describe('getAttributionsByCompositionId', () => {
    it('should get all attributions for a composition', async () => {
      vi.mocked(accessPatternsModule.getAllByPartitionKey).mockResolvedValue({
        items: [
          {
            compositionId: 'composition-123',
            artistId: 'artist-456',
            attributionType: AttributionType.PRIMARY,
            confidence: AttributionConfidence.HIGH,
            addedBy: 'user-123',
          },
          {
            compositionId: 'composition-123',
            artistId: 'artist-789',
            attributionType: AttributionType.DISPUTED,
            confidence: AttributionConfidence.MEDIUM,
            addedBy: 'user-123',
          },
        ],
        lastEvaluatedKey: undefined,
      });

      const result = await CompositionRepository.getAttributionsByCompositionId('composition-123');

      expect(accessPatternsModule.getAllByPartitionKey).toHaveBeenCalledWith(
        'COMPOSITION',
        'composition-123',
        { sortKeyPrefix: 'ATTRIBUTION#' }
      );

      expect(result.items).toHaveLength(2);
      expect(result.items[0].artistId).toBe('artist-456');
      expect(result.items[0].attributionType).toBe(AttributionType.PRIMARY);
      expect(result.items[1].artistId).toBe('artist-789');
      expect(result.items[1].attributionType).toBe(AttributionType.DISPUTED);
    });
  });

  describe('getCompositionsByArtistId', () => {
    it('should get all compositions for an artist', async () => {
      vi.mocked(accessPatternsModule.getByGlobalIndex).mockResolvedValue({
        items: [
          {
            compositionId: 'composition-123',
            artistId: 'artist-456',
            attributionType: AttributionType.PRIMARY,
          },
          {
            compositionId: 'composition-789',
            artistId: 'artist-456',
            attributionType: AttributionType.PRIMARY,
          },
        ],
        lastEvaluatedKey: undefined,
      });

      const result = await CompositionRepository.getCompositionsByArtistId('artist-456');

      expect(accessPatternsModule.getByGlobalIndex).toHaveBeenCalledWith(
        'GSI1',
        'GSI1PK',
        'ARTIST#artist-456',
        expect.any(Object)
      );

      expect(result.items).toHaveLength(2);
      expect(result.items[0].compositionId).toBe('composition-123');
      expect(result.items[1].compositionId).toBe('composition-789');
    });
  });

  // src/domain/composition/repository.test.ts
  // Update the describe('verifyAttribution') section

  describe('verifyAttribution', () => {
    it('should add a user to verifiedBy list', async () => {
      // Mock existing attribution
      const existingAttribution = {
        compositionId: 'composition-123',
        artistId: 'artist-456',
        attributionType: AttributionType.PRIMARY,
        confidence: AttributionConfidence.HIGH,
        addedBy: 'user-123',
        createdAt: '2023-01-01T00:00:00.000Z',
        verifiedBy: ['user-789'],
      };

      vi.mocked(accessPatternsModule.getByPrimaryKey).mockResolvedValue(existingAttribution);

      // Mock the updated attribution return from updateItem
      vi.mocked(dbModule.updateItem).mockResolvedValue({
        ...existingAttribution,
        verifiedBy: ['user-789', 'user-456'],
      });

      await CompositionRepository.verifyAttribution('composition-123', 'artist-456', 'user-456');

      expect(dbModule.updateItem).toHaveBeenCalledWith(
        {
          PK: 'COMPOSITION#composition-123',
          SK: 'ATTRIBUTION#artist-456',
        },
        { verifiedBy: ['user-789', 'user-456'] }
      );
    });

    it('should not add duplicate verification', async () => {
      // Mock existing attribution
      const existingAttribution = {
        compositionId: 'composition-123',
        artistId: 'artist-456',
        attributionType: AttributionType.PRIMARY,
        confidence: AttributionConfidence.HIGH,
        addedBy: 'user-123',
        createdAt: '2023-01-01T00:00:00.000Z',
        verifiedBy: ['user-456'],
      };

      vi.mocked(accessPatternsModule.getByPrimaryKey).mockResolvedValue(existingAttribution);

      // Mock the updated attribution return from updateItem
      vi.mocked(dbModule.updateItem).mockResolvedValue(existingAttribution);

      await CompositionRepository.verifyAttribution('composition-123', 'artist-456', 'user-456');

      expect(dbModule.updateItem).toHaveBeenCalledWith(
        {
          PK: 'COMPOSITION#composition-123',
          SK: 'ATTRIBUTION#artist-456',
        },
        { verifiedBy: ['user-456'] }
      );
    });
  });
});
