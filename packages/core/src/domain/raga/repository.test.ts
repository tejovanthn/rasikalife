// ../../domain/raga/repository.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RagaRepository } from './repository';
import { type CreateRagaInput, Raga } from './schema';
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

describe('RagaRepository', () => {
  // Reset mocks before each test
  beforeEach(() => {
    vi.resetAllMocks();

    // Mock implementations
    vi.mocked(singleTableModule.createBaseItem).mockResolvedValue({
      PK: 'RAGA#test-id-123',
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
    it('should create a new raga with version v1', async () => {
      const input: CreateRagaInput = {
        name: 'Bhairavi',
        tradition: Tradition.CARNATIC,
        melakarta: 8,
        arohanam: 'S R2 G2 M1 P D2 N2 S',
        avarohanam: 'S N2 D2 P M1 G2 R2 S',
        editorId: 'user-123',
      };

      await RagaRepository.create(input);

      // Verify batch put items was called with both raga and latest pointer
      expect(dbModule.batchPutItems).toHaveBeenCalledTimes(1);
      const batchArgs = vi.mocked(dbModule.batchPutItems).mock.calls[0][0];

      // Should have 2 items (raga and latest pointer)
      expect(batchArgs).toHaveLength(2);

      // First item should be raga with correct fields
      expect(batchArgs[0]).toMatchObject({
        name: 'Bhairavi',
        tradition: Tradition.CARNATIC,
        melakarta: 8,
        arohanam: 'S R2 G2 M1 P D2 N2 S',
        avarohanam: 'S N2 D2 P M1 G2 R2 S',
        editorId: 'user-123',
        version: 'v1',
        viewCount: 0,
        editedBy: ['user-123'],
        isLatest: true,
        SK: 'VERSION#v1#2023-01-01T00:00:00.000Z',
      });

      // Second item should be latest pointer
      expect(batchArgs[1]).toMatchObject({
        PK: 'RAGA#test-id-123',
        SK: 'VERSION#LATEST',
        version: 'v1',
        timestamp: '2023-01-01T00:00:00.000Z',
        isLatest: true,
      });
    });

    it('should create GSI entries for searching', async () => {
      const input: CreateRagaInput = {
        name: 'Bhairavi',
        tradition: Tradition.CARNATIC,
        melakarta: 8,
        editorId: 'user-123',
      };

      await RagaRepository.create(input);

      const batchArgs = vi.mocked(dbModule.batchPutItems).mock.calls[0][0];
      const ragaItem = batchArgs[0];

      // Check GSI entries
      expect(ragaItem.GSI1PK).toBe('RAGA_NAME#bhairavi');
      expect(ragaItem.GSI1SK).toBe('RAGA#test-id-123');
      expect(ragaItem.GSI2PK).toBe('MELAKARTA#8');
      expect(ragaItem.GSI2SK).toBe('RAGA#test-id-123');
      expect(ragaItem.GSI3PK).toBe('TRADITION#carnatic');
      expect(ragaItem.GSI3SK).toBe('RAGA#test-id-123');
    });
  });

  describe('getById', () => {
    it('should get latest raga version if version not specified', async () => {
      // Mock latest pointer
      vi.mocked(accessPatternsModule.getByPrimaryKey).mockResolvedValueOnce({
        PK: 'RAGA#test-id',
        SK: 'VERSION#LATEST',
        version: 'v2',
        timestamp: '2023-01-02T00:00:00.000Z',
      });

      // Mock actual raga item
      vi.mocked(accessPatternsModule.getByPrimaryKey).mockResolvedValueOnce({
        PK: 'RAGA#test-id',
        SK: 'VERSION#v2#2023-01-02T00:00:00.000Z',
        id: 'test-id',
        name: 'Bhairavi',
        version: 'v2',
        tradition: Tradition.CARNATIC,
        isLatest: true,
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-02T00:00:00.000Z',
        viewCount: 5,
        editedBy: ['user-123', 'user-456'],
      });

      const raga = await RagaRepository.getById('test-id');

      // Verify correct version was fetched
      expect(accessPatternsModule.getByPrimaryKey).toHaveBeenCalledTimes(2);
      expect(accessPatternsModule.getByPrimaryKey).toHaveBeenCalledWith(
        'RAGA',
        'test-id',
        'VERSION#LATEST'
      );
      expect(accessPatternsModule.getByPrimaryKey).toHaveBeenCalledWith(
        'RAGA',
        'test-id',
        'VERSION#v2#2023-01-02T00:00:00.000Z'
      );

      expect(raga).toMatchObject({
        id: 'test-id',
        name: 'Bhairavi',
        version: 'v2',
        tradition: Tradition.CARNATIC,
        viewCount: 5,
      });
    });

    it('should get specific raga version if version is specified', async () => {
      vi.mocked(accessPatternsModule.getByPrimaryKey).mockResolvedValueOnce({
        PK: 'RAGA#test-id',
        SK: 'VERSION#v1#2023-01-01T00:00:00.000Z',
        id: 'test-id',
        name: 'Bhairavi',
        version: 'v1',
        tradition: Tradition.CARNATIC,
        isLatest: false,
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
        viewCount: 3,
        editedBy: ['user-123'],
      });

      const raga = await RagaRepository.getById('test-id', 'v1');

      // Verify correct version was fetched directly
      expect(accessPatternsModule.getByPrimaryKey).toHaveBeenCalledTimes(1);
      expect(accessPatternsModule.getByPrimaryKey).toHaveBeenCalledWith(
        'RAGA',
        'test-id',
        'VERSION#v1'
      );

      expect(raga).toMatchObject({
        id: 'test-id',
        name: 'Bhairavi',
        version: 'v1',
        tradition: Tradition.CARNATIC,
        viewCount: 3,
      });
    });

    it('should return null if raga not found', async () => {
      vi.mocked(accessPatternsModule.getByPrimaryKey).mockResolvedValue(null);

      const raga = await RagaRepository.getById('nonexistent-id');

      expect(raga).toBeNull();
    });
  });

  describe('update', () => {
    it('should create a new version when updating', async () => {
      // Mock getting current raga
      vi.mocked(accessPatternsModule.getByPrimaryKey)
        .mockResolvedValueOnce({
          PK: 'RAGA#test-id',
          SK: 'VERSION#LATEST',
          version: 'v1',
          timestamp: '2023-01-01T00:00:00.000Z',
        })
        .mockResolvedValueOnce({
          PK: 'RAGA#test-id',
          SK: 'VERSION#v1#2023-01-01T00:00:00.000Z',
          id: 'test-id',
          name: 'Bhairavi',
          version: 'v1',
          tradition: Tradition.CARNATIC,
          isLatest: true,
          createdAt: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-01T00:00:00.000Z',
          viewCount: 5,
          editedBy: ['user-123'],
        });

      const updateInput = {
        notes: 'Updated notes about Bhairavi raga',
        editorId: 'user-456',
      };

      await RagaRepository.update('test-id', updateInput);

      // Should have created 3 items in batch (new version, latest pointer, old version update)
      expect(dbModule.batchPutItems).toHaveBeenCalledTimes(1);
      const batchArgs = vi.mocked(dbModule.batchPutItems).mock.calls[0][0];
      expect(batchArgs).toHaveLength(3);

      // First item should be new raga version with correct fields
      expect(batchArgs[0]).toMatchObject({
        id: 'test-id',
        name: 'Bhairavi',
        version: 'v2',
        tradition: Tradition.CARNATIC,
        notes: 'Updated notes about Bhairavi raga',
        isLatest: true,
        viewCount: 5,
        editedBy: ['user-123', 'user-456'], // Both editors
        SK: 'VERSION#v2#2023-01-01T00:00:00.000Z',
      });

      // Second item should be updated latest pointer
      expect(batchArgs[1]).toMatchObject({
        PK: 'RAGA#test-id',
        SK: 'VERSION#LATEST',
        version: 'v2',
        timestamp: '2023-01-01T00:00:00.000Z',
        isLatest: true,
      });

      // Third item should mark old version as not latest
      expect(batchArgs[2]).toMatchObject({
        PK: 'RAGA#test-id',
        SK: 'VERSION#v1#2023-01-01T00:00:00.000Z',
        isLatest: false,
      });
    });

    it('should throw error if raga not found', async () => {
      vi.mocked(accessPatternsModule.getByPrimaryKey).mockResolvedValue(null);

      await expect(
        RagaRepository.update('nonexistent-id', {
          editorId: 'user-123',
        })
      ).rejects.toThrow('Raga nonexistent-id not found');
    });
  });

  describe('getVersionHistory', () => {
    it('should return all versions of a raga', async () => {
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
          {
            version: 'v3',
            updatedAt: '2023-01-03T00:00:00.000Z',
            editedBy: ['user-123', 'user-456', 'user-789'],
          },
        ],
        lastEvaluatedKey: undefined,
      });

      const versions = await RagaRepository.getVersionHistory('test-id');

      expect(accessPatternsModule.getAllByPartitionKey).toHaveBeenCalledWith('RAGA', 'test-id', {
        sortKeyPrefix: 'VERSION#v',
      });

      expect(versions).toHaveLength(3);
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
      expect(versions[2]).toMatchObject({
        id: 'test-id',
        version: 'v3',
        timestamp: '2023-01-03T00:00:00.000Z',
        editorId: 'user-789',
      });
    });
  });

  describe('getByName', () => {
    it('should find raga by name', async () => {
      vi.mocked(accessPatternsModule.getByGlobalIndex).mockResolvedValue({
        items: [
          {
            id: 'test-id',
            name: 'Bhairavi',
            version: 'v1',
            isLatest: true,
          },
        ],
        lastEvaluatedKey: undefined,
      });

      // Mock the getById call to return the full raga
      vi.mocked(accessPatternsModule.getByPrimaryKey)
        .mockResolvedValueOnce({
          PK: 'RAGA#test-id',
          SK: 'VERSION#LATEST',
          version: 'v1',
          timestamp: '2023-01-01T00:00:00.000Z',
        })
        .mockResolvedValueOnce({
          id: 'test-id',
          name: 'Bhairavi',
          version: 'v1',
          tradition: Tradition.CARNATIC,
          isLatest: true,
          PK: 'RAGA#test-id',
          SK: 'VERSION#v1#2023-01-01T00:00:00.000Z',
          createdAt: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-01T00:00:00.000Z',
          viewCount: 5,
          editedBy: ['user-123'],
        });

      const raga = await RagaRepository.getByName('Bhairavi');

      expect(accessPatternsModule.getByGlobalIndex).toHaveBeenCalledWith(
        'GSI1',
        'GSI1PK',
        'RAGA_NAME#bhairavi',
        { limit: 1 }
      );

      expect(raga).toMatchObject({
        id: 'test-id',
        name: 'Bhairavi',
        tradition: Tradition.CARNATIC,
      });
    });

    it('should return null if no raga found with name', async () => {
      vi.mocked(accessPatternsModule.getByGlobalIndex).mockResolvedValue({
        items: [],
        lastEvaluatedKey: undefined,
      });

      const raga = await RagaRepository.getByName('NonexistentRaga');

      expect(raga).toBeNull();
    });
  });

  describe('search', () => {
    it('should search ragas by name prefix', async () => {
      vi.mocked(dbModule.query).mockResolvedValue({
        items: [
          {
            id: 'raga-1',
            name: 'Bhairavi',
            isLatest: true,
          },
          {
            id: 'raga-2',
            name: 'Bhairav',
            isLatest: true,
          },
          {
            id: 'raga-3',
            name: 'Bhairavam',
            isLatest: false, // This should be filtered out
          },
        ],
        lastEvaluatedKey: undefined,
      });

      const results = await RagaRepository.search('Bhair');

      expect(dbModule.query).toHaveBeenCalledWith(
        expect.objectContaining({
          IndexName: 'GSI1',
          KeyConditionExpression: 'GSI1PK BETWEEN :start AND :end',
        })
      );

      expect(results.items).toHaveLength(2); // Only latest versions
      expect(results.items.map(r => r.name)).toEqual(['Bhairavi', 'Bhairav']);
    });
  });

  describe('incrementViewCount', () => {
    it('should increment the view count on the latest version', async () => {
      vi.mocked(accessPatternsModule.getByPrimaryKey).mockResolvedValue({
        PK: 'RAGA#test-id',
        SK: 'VERSION#LATEST',
        version: 'v2',
        timestamp: '2023-01-02T00:00:00.000Z',
      });

      await RagaRepository.incrementViewCount('test-id');

      expect(dbModule.updateItem).toHaveBeenCalledWith(
        {
          PK: 'RAGA#test-id',
          SK: 'VERSION#v2#2023-01-02T00:00:00.000Z',
        },
        { viewCount: { $increment: 1 } }
      );
    });

    it('should do nothing if raga not found', async () => {
      vi.mocked(accessPatternsModule.getByPrimaryKey).mockResolvedValue(null);

      await RagaRepository.incrementViewCount('nonexistent-id');

      expect(dbModule.updateItem).not.toHaveBeenCalled();
    });
  });
});
