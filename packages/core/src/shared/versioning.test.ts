import { vi, describe, beforeEach, it, expect } from 'vitest';
import { VersioningService } from './versioning';
import { EntityPrefix } from './singleTable';
import { z } from 'zod';

// Mock dependencies
vi.mock('../db', () => ({
  batchPutItems: vi.fn().mockResolvedValue(undefined),
  getByPrimaryKey: vi.fn().mockResolvedValue(null),
}));

vi.mock('./accessPatterns', () => ({
  getAllByPartitionKey: vi.fn().mockResolvedValue({ items: [], lastEvaluatedKey: undefined }),
}));

vi.mock('./singleTable', () => ({
  createBaseItem: vi.fn().mockResolvedValue({
    id: 'test-id-123',
    PK: 'TEST#test-id-123',
    createdAt: '2025-01-15T12:00:00.000Z',
  }),
  formatKey: vi.fn((prefix, id) => `${prefix}#${id}`),
  formatVersionKey: vi.fn(
    (version, timestamp) => `VERSION#${version}#${timestamp || '2025-01-15T12:00:00.000Z'}`
  ),
  EntityPrefix: {
    TEST: 'TEST',
    COMPOSITION: 'COMPOSITION',
    ARTIST: 'ARTIST',
  },
}));

vi.mock('../utils', () => ({
  getCurrentISOString: vi.fn(() => '2025-01-15T12:00:00.000Z'),
}));

// Test schema and types
const testSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  editorId: z.string(),
  editedBy: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
  viewCount: z.number(),
  isLatest: z.boolean(),
});

type TestEntity = z.infer<typeof testSchema>;

interface TestDynamoItem {
  PK: string;
  SK: string;
  id: string;
  name: string;
  version: string;
  editorId: string;
  editedBy: string[];
  createdAt: string;
  updatedAt: string;
  viewCount: number;
  isLatest: boolean;
}

interface TestCreateInput {
  name: string;
  editorId: string;
}

interface TestUpdateInput {
  name?: string;
  editorId: string;
}

const mockConfig = {
  entityPrefix: EntityPrefix.TEST as any,
  schema: testSchema,
  applyGSIMappings: vi.fn((item: TestDynamoItem) => ({
    GSI1PK: `NAME#${item.name?.toLowerCase()}`,
    GSI1SK: item.PK,
  })),
  applyDefaults: vi.fn((input: TestCreateInput) => ({
    category: 'default',
    status: 'active',
  })),
};

describe('VersioningService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new versioned entity successfully', async () => {
      const input: TestCreateInput = {
        name: 'Test Entity',
        editorId: 'user-123',
      };

      const result = await VersioningService.create(input, mockConfig);

      expect(result).toMatchObject({
        id: 'test-id-123',
        name: 'Test Entity',
        version: 'v1',
        editorId: 'user-123',
        editedBy: ['user-123'],
        viewCount: 0,
        isLatest: true,
      });

      // Verify batch put was called with both version and latest pointer
      const { batchPutItems } = await import('../db');
      expect(batchPutItems).toHaveBeenCalledWith([
        expect.objectContaining({
          SK: 'VERSION#v1#2025-01-15T12:00:00.000Z',
          version: 'v1',
          isLatest: true,
        }),
        expect.objectContaining({
          SK: 'VERSION#LATEST',
          version: 'v1',
          isLatest: true,
        }),
      ]);
    });

    it('should apply GSI mappings during creation', async () => {
      const input: TestCreateInput = {
        name: 'Test Entity',
        editorId: 'user-123',
      };

      await VersioningService.create(input, mockConfig);

      expect(mockConfig.applyGSIMappings).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Entity',
          version: 'v1',
        }),
        input
      );

      const { batchPutItems } = await import('../db');
      expect(batchPutItems).toHaveBeenCalledWith([
        expect.objectContaining({
          GSI1PK: 'NAME#test entity',
          GSI1SK: 'TEST#test-id-123',
        }),
        expect.objectContaining({
          GSI1PK: 'NAME#test entity',
          GSI1SK: 'TEST#test-id-123',
        }),
      ]);
    });

    it('should apply default values when provided', async () => {
      const input: TestCreateInput = {
        name: 'Test Entity',
        editorId: 'user-123',
      };

      await VersioningService.create(input, mockConfig);

      expect(mockConfig.applyDefaults).toHaveBeenCalledWith(input);

      const { batchPutItems } = await import('../db');
      expect(batchPutItems).toHaveBeenCalledWith([
        expect.objectContaining({
          category: 'default',
          status: 'active',
        }),
        expect.objectContaining({
          category: 'default',
          status: 'active',
        }),
      ]);
    });
  });

  describe('update', () => {
    const mockCurrentEntity: TestEntity = {
      id: 'test-id-123',
      name: 'Original Name',
      version: 'v1',
      editorId: 'user-123',
      editedBy: ['user-123'],
      createdAt: '2025-01-15T12:00:00.000Z',
      updatedAt: '2025-01-15T12:00:00.000Z',
      viewCount: 5,
      isLatest: true,
    };

    const mockGetCurrentEntity = vi.fn().mockResolvedValue(mockCurrentEntity);

    it('should create new version when updating existing entity', async () => {
      const input: TestUpdateInput = {
        name: 'Updated Name',
        editorId: 'user-456',
      };

      const result = await VersioningService.update(
        'test-id-123',
        input,
        mockConfig,
        mockGetCurrentEntity
      );

      expect(result).toMatchObject({
        id: 'test-id-123',
        name: 'Updated Name',
        version: 'v2',
        editorId: 'user-456',
        editedBy: ['user-123', 'user-456'],
      });

      const { batchPutItems } = await import('../db');
      expect(batchPutItems).toHaveBeenCalledWith([
        expect.objectContaining({
          SK: 'VERSION#v2#2025-01-15T12:00:00.000Z',
          version: 'v2',
          name: 'Updated Name',
        }),
        expect.objectContaining({
          SK: 'VERSION#LATEST',
          version: 'v2',
          name: 'Updated Name',
        }),
      ]);
    });

    it('should increment version number correctly', async () => {
      // Test with v5 to ensure proper parsing
      const v5Entity = { ...mockCurrentEntity, version: 'v5' };
      mockGetCurrentEntity.mockResolvedValueOnce(v5Entity);

      const input: TestUpdateInput = {
        name: 'Updated Name',
        editorId: 'user-456',
      };

      const result = await VersioningService.update(
        'test-id-123',
        input,
        mockConfig,
        mockGetCurrentEntity
      );

      expect(result.version).toBe('v6');
    });

    it('should preserve existing data and merge updates', async () => {
      const input: TestUpdateInput = {
        name: 'Updated Name',
        editorId: 'user-456',
      };

      const result = await VersioningService.update(
        'test-id-123',
        input,
        mockConfig,
        mockGetCurrentEntity
      );

      // Should preserve viewCount and other existing fields
      expect(result.viewCount).toBe(5);
      expect(result.createdAt).toBe('2025-01-15T12:00:00.000Z');
      // Should update the name
      expect(result.name).toBe('Updated Name');
    });

    it('should maintain unique editedBy list', async () => {
      // Entity already edited by user-456
      const entityWithDuplicateEditor = {
        ...mockCurrentEntity,
        editedBy: ['user-123', 'user-456'],
      };
      mockGetCurrentEntity.mockResolvedValueOnce(entityWithDuplicateEditor);

      const input: TestUpdateInput = {
        name: 'Updated Name',
        editorId: 'user-456', // Same editor
      };

      const result = await VersioningService.update(
        'test-id-123',
        input,
        mockConfig,
        mockGetCurrentEntity
      );

      // Should not duplicate the editor
      expect(result.editedBy).toEqual(['user-123', 'user-456']);
    });

    it('should throw error when entity not found', async () => {
      mockGetCurrentEntity.mockResolvedValueOnce(null);

      const input: TestUpdateInput = {
        name: 'Updated Name',
        editorId: 'user-456',
      };

      await expect(
        VersioningService.update('nonexistent', input, mockConfig, mockGetCurrentEntity)
      ).rejects.toThrow('Entity nonexistent not found');
    });
  });

  describe('getById', () => {
    it('should get latest version when no version specified', async () => {
      const mockEntity = {
        id: 'test-id-123',
        name: 'Test Entity',
        version: 'v3',
      };

      const { getByPrimaryKey } = await import('../db');
      vi.mocked(getByPrimaryKey).mockResolvedValueOnce(mockEntity);

      const result = await VersioningService.getById('test-id-123', mockConfig);

      expect(getByPrimaryKey).toHaveBeenCalledWith(
        EntityPrefix.TEST,
        'test-id-123',
        'VERSION#LATEST'
      );
      expect(result).toEqual(mockEntity);
    });

    it('should get specific version when version specified', async () => {
      const mockEntity = {
        id: 'test-id-123',
        name: 'Test Entity',
        version: 'v2',
      };

      const { getByPrimaryKey } = await import('../db');
      vi.mocked(getByPrimaryKey).mockResolvedValueOnce(mockEntity);

      const result = await VersioningService.getById('test-id-123', mockConfig, 'v2');

      expect(getByPrimaryKey).toHaveBeenCalledWith(
        EntityPrefix.TEST,
        'test-id-123',
        'VERSION#v2#2025-01-15T12:00:00.000Z'
      );
      expect(result).toEqual(mockEntity);
    });

    it('should return null when entity not found', async () => {
      const { getByPrimaryKey } = await import('../db');
      vi.mocked(getByPrimaryKey).mockResolvedValueOnce(null);

      const result = await VersioningService.getById('nonexistent', mockConfig);

      expect(result).toBeNull();
    });
  });

  describe('getVersionHistory', () => {
    it('should return version history for entity', async () => {
      const mockVersions = [
        {
          version: 'v1',
          updatedAt: '2025-01-15T12:00:00.000Z',
          editedBy: ['user-123'],
        },
        {
          version: 'v2',
          updatedAt: '2025-01-15T13:00:00.000Z',
          editedBy: ['user-123', 'user-456'],
        },
        {
          version: 'v3',
          createdAt: '2025-01-15T14:00:00.000Z',
          editedBy: ['user-123', 'user-456', 'user-789'],
        },
      ];

      const { getAllByPartitionKey } = await import('./accessPatterns');
      vi.mocked(getAllByPartitionKey).mockResolvedValueOnce({
        items: mockVersions,
        lastEvaluatedKey: undefined,
      });

      const result = await VersioningService.getVersionHistory(
        'test-id-123',
        EntityPrefix.TEST as any
      );

      expect(getAllByPartitionKey).toHaveBeenCalledWith(EntityPrefix.TEST, 'test-id-123', {
        sortKeyPrefix: 'VERSION#v',
      });

      expect(result).toEqual([
        {
          id: 'test-id-123',
          version: 'v1',
          timestamp: '2025-01-15T12:00:00.000Z',
          editorId: 'user-123',
        },
        {
          id: 'test-id-123',
          version: 'v2',
          timestamp: '2025-01-15T13:00:00.000Z',
          editorId: 'user-456',
        },
        {
          id: 'test-id-123',
          version: 'v3',
          timestamp: '2025-01-15T14:00:00.000Z',
          editorId: 'user-789',
        },
      ]);
    });

    it('should handle empty version history', async () => {
      const { getAllByPartitionKey } = await import('./accessPatterns');
      vi.mocked(getAllByPartitionKey).mockResolvedValueOnce({
        items: [],
        lastEvaluatedKey: undefined,
      });

      const result = await VersioningService.getVersionHistory(
        'test-id-123',
        EntityPrefix.TEST as any
      );

      expect(result).toEqual([]);
    });

    it('should use latest editor from editedBy array', async () => {
      const mockVersions = [
        {
          version: 'v1',
          updatedAt: '2025-01-15T12:00:00.000Z',
          editedBy: ['user-123', 'user-456', 'user-789'],
        },
      ];

      const { getAllByPartitionKey } = await import('./accessPatterns');
      vi.mocked(getAllByPartitionKey).mockResolvedValueOnce({
        items: mockVersions,
        lastEvaluatedKey: undefined,
      });

      const result = await VersioningService.getVersionHistory(
        'test-id-123',
        EntityPrefix.TEST as any
      );

      expect(result[0].editorId).toBe('user-789'); // Last editor in array
    });
  });

  describe('incrementViewCount', () => {
    it('should throw not implemented error', async () => {
      await expect(
        VersioningService.incrementViewCount('test-id', EntityPrefix.TEST as any)
      ).rejects.toThrow(
        'incrementViewCount should be implemented in individual repositories for now'
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle entity with no applyDefaults function', async () => {
      const configWithoutDefaults = {
        ...mockConfig,
        applyDefaults: undefined,
      };

      const input: TestCreateInput = {
        name: 'Test Entity',
        editorId: 'user-123',
      };

      const result = await VersioningService.create(input, configWithoutDefaults);

      expect(result).toMatchObject({
        name: 'Test Entity',
        version: 'v1',
      });
    });

    it('should handle version parsing edge cases', async () => {
      // Test with version v99
      const mockCurrentEntity: TestEntity = {
        id: 'test-id-123',
        name: 'Original Name',
        version: 'v1',
        editorId: 'user-123',
        editedBy: ['user-123'],
        createdAt: '2025-01-15T12:00:00.000Z',
        updatedAt: '2025-01-15T12:00:00.000Z',
        viewCount: 5,
        isLatest: true,
      };

      const highVersionEntity = { ...mockCurrentEntity, version: 'v99' };
      const mockGetCurrentEntity = vi.fn().mockResolvedValue(highVersionEntity);

      const input: TestUpdateInput = {
        name: 'Updated Name',
        editorId: 'user-456',
      };

      const result = await VersioningService.update(
        'test-id-123',
        input,
        mockConfig,
        mockGetCurrentEntity
      );

      expect(result.version).toBe('v100');
    });
  });
});
