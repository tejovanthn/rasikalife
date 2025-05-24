// ../../domain/tala/repository.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TalaRepository } from './repository';
import { type CreateTalaInput, Tala } from './schema';
import * as dbModule from '../../db';
import * as accessPatternsModule from '../../shared/accessPatterns';
import * as singleTableModule from '../../shared/singleTable';
import { Tradition } from '../artist';

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

describe('TalaRepository', () => {
  // Reset mocks before each test
  beforeEach(() => {
    vi.resetAllMocks();

    // Mock implementations
    vi.mocked(singleTableModule.createBaseItem).mockResolvedValue({
      PK: 'TALA#test-id-123',
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
    it('should create a new tala with version v1', async () => {
      const input: CreateTalaInput = {
        name: 'Adi Tala',
        type: 'Suladi',
        aksharas: 8,
        structure: '4+2+2',
        tradition: Tradition.CARNATIC,
        editorId: 'user-123',
      };

      await TalaRepository.create(input);

      // Verify batch put items was called with both tala and latest pointer
      expect(dbModule.batchPutItems).toHaveBeenCalledTimes(1);
      const batchArgs = vi.mocked(dbModule.batchPutItems).mock.calls[0][0];

      // Should have 2 items (tala and latest pointer)
      expect(batchArgs).toHaveLength(2);

      // First item should be tala with correct fields
      expect(batchArgs[0]).toMatchObject({
        name: 'Adi Tala',
        type: 'Suladi',
        aksharas: 8,
        structure: '4+2+2',
        tradition: Tradition.CARNATIC,
        editorId: 'user-123',
        version: 'v1',
        viewCount: 0,
        editedBy: ['user-123'],
        isLatest: true,
        SK: 'VERSION#v1#2023-01-01T00:00:00.000Z',
      });

      // Second item should be latest pointer
      expect(batchArgs[1]).toMatchObject({
        PK: 'TALA#test-id-123',
        SK: 'VERSION#LATEST',
        version: 'v1',
        timestamp: '2023-01-01T00:00:00.000Z',
        isLatest: true,
      });
    });

    it('should create GSI entries for searching', async () => {
      const input: CreateTalaInput = {
        name: 'Adi Tala',
        type: 'Suladi',
        aksharas: 8,
        tradition: Tradition.CARNATIC,
        editorId: 'user-123',
      };

      await TalaRepository.create(input);

      const batchArgs = vi.mocked(dbModule.batchPutItems).mock.calls[0][0];
      const talaItem = batchArgs[0];

      // Check GSI entries
      expect(talaItem.GSI1PK).toBe('TALA_NAME#adi tala');
      expect(talaItem.GSI1SK).toBe('TALA#test-id-123');
      expect(talaItem.GSI2PK).toBe('AKSHARAS#8');
      expect(talaItem.GSI2SK).toBe('TALA#test-id-123');
      expect(talaItem.GSI3PK).toBe('TALA_TYPE#suladi');
      expect(talaItem.GSI3SK).toBe('TALA#test-id-123');
      expect(talaItem.GSI4PK).toBe('TRADITION#carnatic');
      expect(talaItem.GSI4SK).toBe('TALA#test-id-123');
    });
  });

  describe('getById', () => {
    it('should get latest tala version if version not specified', async () => {
      // Mock latest pointer
      vi.mocked(accessPatternsModule.getByPrimaryKey).mockResolvedValueOnce({
        PK: 'TALA#test-id',
        SK: 'VERSION#LATEST',
        version: 'v2',
        timestamp: '2023-01-02T00:00:00.000Z',
      });

      // Mock actual tala item
      vi.mocked(accessPatternsModule.getByPrimaryKey).mockResolvedValueOnce({
        PK: 'TALA#test-id',
        SK: 'VERSION#v2#2023-01-02T00:00:00.000Z',
        id: 'test-id',
        name: 'Adi Tala',
        type: 'Suladi',
        aksharas: 8,
        version: 'v2',
        tradition: Tradition.CARNATIC,
        isLatest: true,
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-02T00:00:00.000Z',
        viewCount: 5,
        editedBy: ['user-123', 'user-456'],
      });

      const tala = await TalaRepository.getById('test-id');

      // Verify correct version was fetched
      expect(accessPatternsModule.getByPrimaryKey).toHaveBeenCalledTimes(2);
      expect(accessPatternsModule.getByPrimaryKey).toHaveBeenCalledWith(
        'TALA',
        'test-id',
        'VERSION#LATEST'
      );
      expect(accessPatternsModule.getByPrimaryKey).toHaveBeenCalledWith(
        'TALA',
        'test-id',
        'VERSION#v2#2023-01-02T00:00:00.000Z'
      );

      expect(tala).toMatchObject({
        id: 'test-id',
        name: 'Adi Tala',
        type: 'Suladi',
        aksharas: 8,
        version: 'v2',
        tradition: Tradition.CARNATIC,
        viewCount: 5,
      });
    });

    it('should get specific tala version if version is specified', async () => {
      vi.mocked(accessPatternsModule.getByPrimaryKey).mockResolvedValueOnce({
        PK: 'TALA#test-id',
        SK: 'VERSION#v1#2023-01-01T00:00:00.000Z',
        id: 'test-id',
        name: 'Adi Tala',
        type: 'Suladi',
        aksharas: 8,
        version: 'v1',
        tradition: Tradition.CARNATIC,
        isLatest: false,
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
        viewCount: 3,
        editedBy: ['user-123'],
      });

      const tala = await TalaRepository.getById('test-id', 'v1');

      // Verify correct version was fetched directly
      expect(accessPatternsModule.getByPrimaryKey).toHaveBeenCalledTimes(1);
      expect(accessPatternsModule.getByPrimaryKey).toHaveBeenCalledWith(
        'TALA',
        'test-id',
        'VERSION#v1'
      );

      expect(tala).toMatchObject({
        id: 'test-id',
        name: 'Adi Tala',
        type: 'Suladi',
        aksharas: 8,
        version: 'v1',
        tradition: Tradition.CARNATIC,
        viewCount: 3,
      });
    });

    it('should return null if tala not found', async () => {
      vi.mocked(accessPatternsModule.getByPrimaryKey).mockResolvedValue(null);

      const tala = await TalaRepository.getById('nonexistent-id');

      expect(tala).toBeNull();
    });
  });

  describe('update', () => {
    it('should create a new version when updating', async () => {
      // Mock getting current tala
      vi.mocked(accessPatternsModule.getByPrimaryKey)
        .mockResolvedValueOnce({
          PK: 'TALA#test-id',
          SK: 'VERSION#LATEST',
          version: 'v1',
          timestamp: '2023-01-01T00:00:00.000Z',
        })
        .mockResolvedValueOnce({
          PK: 'TALA#test-id',
          SK: 'VERSION#v1#2023-01-01T00:00:00.000Z',
          id: 'test-id',
          name: 'Adi Tala',
          type: 'Suladi',
          aksharas: 8,
          version: 'v1',
          tradition: Tradition.CARNATIC,
          isLatest: true,
          createdAt: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-01T00:00:00.000Z',
          viewCount: 5,
          editedBy: ['user-123'],
        });

      const updateInput = {
        structure: '4+2+2',
        editorId: 'user-456',
      };

      await TalaRepository.update('test-id', updateInput);

      // Should have created 3 items in batch (new version, latest pointer, old version update)
      expect(dbModule.batchPutItems).toHaveBeenCalledTimes(1);
      const batchArgs = vi.mocked(dbModule.batchPutItems).mock.calls[0][0];
      expect(batchArgs).toHaveLength(3);

      // First item should be new tala version with correct fields
      expect(batchArgs[0]).toMatchObject({
        id: 'test-id',
        name: 'Adi Tala',
        type: 'Suladi',
        aksharas: 8,
        version: 'v2',
        structure: '4+2+2',
        tradition: Tradition.CARNATIC,
        isLatest: true,
        viewCount: 5,
        editedBy: ['user-123', 'user-456'], // Both editors
        SK: 'VERSION#v2#2023-01-01T00:00:00.000Z',
      });

      // Second item should be updated latest pointer
      expect(batchArgs[1]).toMatchObject({
        PK: 'TALA#test-id',
        SK: 'VERSION#LATEST',
        version: 'v2',
        timestamp: '2023-01-01T00:00:00.000Z',
        isLatest: true,
      });

      // Third item should mark old version as not latest
      expect(batchArgs[2]).toMatchObject({
        PK: 'TALA#test-id',
        SK: 'VERSION#v1#2023-01-01T00:00:00.000Z',
        isLatest: false,
      });
    });

    it('should throw error if tala not found', async () => {
      vi.mocked(accessPatternsModule.getByPrimaryKey).mockResolvedValue(null);

      await expect(
        TalaRepository.update('nonexistent-id', {
          editorId: 'user-123',
        })
      ).rejects.toThrow('Tala nonexistent-id not found');
    });
  });

  describe('getVersionHistory', () => {
    it('should return all versions of a tala', async () => {
      vi.mocked(accessPatternsModule.getAllByPartitionKey).mockResolvedValue({
        items: [
          {
            version: 'v1',
            createdAt: '2023-01-01T00:00:00.000Z',
            editedBy: ['user-123'],
          },
          {
            version: 'v2',
            updatedAt: '2023-01-02T00:00:00.000Z',
            editedBy: ['user-123', 'user-456'],
          },
        ],
        lastEvaluatedKey: undefined,
      });

      const versions = await TalaRepository.getVersionHistory('test-id');

      expect(accessPatternsModule.getAllByPartitionKey).toHaveBeenCalledWith('TALA', 'test-id', {
        sortKeyPrefix: 'VERSION#v',
      });

      expect(versions).toHaveLength(2);
      expect(versions[0]).toMatchObject({
        id: 'test-id',
        version: 'v1',
        timestamp: '2023-01-01T00:00:00.000Z',
        editorId: 'user-123',
      });
      expect(versions[1]).toMatchObject({
        id: 'test-id',
        version: 'v2',
        timestamp: '2023-01-02T00:00:00.000Z',
        editorId: 'user-456',
      });
    });
  });

  describe('getByName', () => {
    it('should find tala by name', async () => {
      vi.mocked(accessPatternsModule.getByGlobalIndex).mockResolvedValue({
        items: [
          {
            id: 'test-id',
            name: 'Adi Tala',
            version: 'v1',
            isLatest: true,
          },
        ],
        lastEvaluatedKey: undefined,
      });

      // Mock the getById call to return the full tala
      vi.mocked(accessPatternsModule.getByPrimaryKey)
        .mockResolvedValueOnce({
          PK: 'TALA#test-id',
          SK: 'VERSION#LATEST',
          version: 'v1',
          timestamp: '2023-01-01T00:00:00.000Z',
        })
        .mockResolvedValueOnce({
          id: 'test-id',
          name: 'Adi Tala',
          type: 'Suladi',
          aksharas: 8,
          version: 'v1',
          tradition: Tradition.CARNATIC,
          isLatest: true,
          PK: 'TALA#test-id',
          SK: 'VERSION#v1#2023-01-01T00:00:00.000Z',
          createdAt: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-01T00:00:00.000Z',
          viewCount: 5,
          editedBy: ['user-123'],
        });

      const tala = await TalaRepository.getByName('Adi Tala');

      expect(accessPatternsModule.getByGlobalIndex).toHaveBeenCalledWith(
        'GSI1',
        'GSI1PK',
        'TALA_NAME#adi tala',
        { limit: 1 }
      );

      expect(tala).toMatchObject({
        id: 'test-id',
        name: 'Adi Tala',
        type: 'Suladi',
        aksharas: 8,
        tradition: Tradition.CARNATIC,
      });
    });

    it('should return null if no tala found with name', async () => {
      vi.mocked(accessPatternsModule.getByGlobalIndex).mockResolvedValue({
        items: [],
        lastEvaluatedKey: undefined,
      });

      const tala = await TalaRepository.getByName('NonexistentTala');

      expect(tala).toBeNull();
    });
  });

  describe('getByAksharas', () => {
    it('should find talas by aksharas count', async () => {
      vi.mocked(accessPatternsModule.getByGlobalIndex).mockResolvedValue({
        items: [
          {
            id: 'test-id-1',
            name: 'Adi Tala',
            aksharas: 8,
            isLatest: true,
          },
          {
            id: 'test-id-2',
            name: 'Rupaka Tala',
            aksharas: 8,
            isLatest: false, // Should be filtered out
          },
        ],
        lastEvaluatedKey: undefined,
      });

      const result = await TalaRepository.getByAksharas(8);

      expect(accessPatternsModule.getByGlobalIndex).toHaveBeenCalledWith(
        'GSI2',
        'GSI2PK',
        'AKSHARAS#8',
        expect.objectContaining({ limit: 20 })
      );

      // Should have filtered out non-latest version
      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe('Adi Tala');
    });
  });

  describe('search', () => {
    it('should search talas by name prefix', async () => {
      vi.mocked(dbModule.query).mockResolvedValue({
        items: [
          {
            id: 'tala-1',
            name: 'Adi Tala',
            isLatest: true,
          },
          {
            id: 'tala-2',
            name: 'Adi Tala Variant',
            isLatest: true,
          },
          {
            id: 'tala-3',
            name: 'Old Adi',
            isLatest: false, // This should be filtered out
          },
        ],
        lastEvaluatedKey: undefined,
      });

      const results = await TalaRepository.search('Adi');

      expect(dbModule.query).toHaveBeenCalledWith(
        expect.objectContaining({
          IndexName: 'GSI1',
          KeyConditionExpression: 'GSI1PK BETWEEN :start AND :end',
        })
      );

      expect(results.items).toHaveLength(2); // Only latest versions
      expect(results.items.map(r => r.name)).toEqual(['Adi Tala', 'Adi Tala Variant']);
    });
  });

  describe('incrementViewCount', () => {
    it('should increment the view count on the latest version', async () => {
      vi.mocked(accessPatternsModule.getByPrimaryKey).mockResolvedValue({
        PK: 'TALA#test-id',
        SK: 'VERSION#LATEST',
        version: 'v2',
        timestamp: '2023-01-02T00:00:00.000Z',
      });

      await TalaRepository.incrementViewCount('test-id');

      expect(dbModule.updateItem).toHaveBeenCalledWith(
        {
          PK: 'TALA#test-id',
          SK: 'VERSION#v2#2023-01-02T00:00:00.000Z',
        },
        { viewCount: { $increment: 1 } }
      );
    });

    it('should do nothing if tala not found', async () => {
      vi.mocked(accessPatternsModule.getByPrimaryKey).mockResolvedValue(null);

      await TalaRepository.incrementViewCount('nonexistent-id');

      expect(dbModule.updateItem).not.toHaveBeenCalled();
    });
  });
});
