/**
 * Content repository tests
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as db from '../../db';
import * as accessPatterns from '../../shared/accessPatterns';
import { ContentRepository } from './repository';
import { ContentCategory, ContentStatus, ContentVisibility } from './schema';
import type { ContentDynamoItem } from './types';

const { getByPrimaryKey, getByGlobalIndex } = accessPatterns;
const { putItem, updateItem } = db;

// Mock the database operations
vi.mock('../../db', () => ({
  putItem: vi.fn().mockResolvedValue(undefined),
  updateItem: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../shared/accessPatterns', () => ({
  getByPrimaryKey: vi.fn().mockResolvedValue(null),
  getByGlobalIndex: vi.fn().mockResolvedValue({ items: [], hasMore: false }),
}));

describe('ContentRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should create content with all required fields', async () => {
      const input = {
        path: '/test-content',
        content: 'Test content body',
        editorId: 'user123',
      };

      vi.mocked(db.putItem).mockResolvedValue(undefined);

      const result = await ContentRepository.create(input);

      expect(result.path).toBe('/test-content');
      expect(result.content).toBe('Test content body');
      expect(result.createdBy).toBe('user123');
      expect(result.updatedBy).toBe('user123');
      expect(result.editedBy).toEqual(['user123']);
      expect(result.status).toBe(ContentStatus.PUBLISHED);
      expect(result.visibility).toBe(ContentVisibility.PUBLIC);
      expect(result.category).toBe(ContentCategory.GENERAL);
      expect(result.viewCount).toBe(0);
      expect(result.version).toBe('v1');
      expect(result.isLatest).toBe(true);
      expect(result.PK).toMatch(/^CONTENT#/);
      expect(result.SK).toBe('#METADATA');
    });

    it('should create GSI fields for searchability', async () => {
      const input = {
        path: '/about',
        content: 'About us content',
        editorId: 'admin',
        status: ContentStatus.DRAFT,
        category: ContentCategory.ABOUT,
        visibility: ContentVisibility.MEMBERS,
      };

      vi.mocked(db.putItem).mockResolvedValue(undefined);

      const result = await ContentRepository.create(input);

      expect(result.status).toBe(ContentStatus.DRAFT);
      expect(result.category).toBe(ContentCategory.ABOUT);
      expect(result.visibility).toBe(ContentVisibility.MEMBERS);
      expect(result.GSI1PK).toBe('CONTENT_CATEGORY#about');
      expect(result.GSI2PK).toBe('CONTENT_STATUS#draft');
      expect(result.GSI3PK).toBe('CONTENT_PATH');
      expect(result.GSI3SK).toBe('/about');
    });

    it('should handle auxiliary content (meta, navigation, sections)', async () => {
      const input = {
        path: '/comprehensive-page',
        content: '# Full Page\n\nContent here',
        editorId: 'creator',
        meta: {
          title: 'Comprehensive Page',
          description: 'A page with all features',
          keywords: ['test', 'comprehensive'],
        },
        navigation: {
          breadcrumbs: [
            { label: 'Home', path: '/' },
            { label: 'Page', path: '/comprehensive-page' },
          ],
          menuPlacement: { section: 'main', order: 1 },
        },
        sections: [
          {
            id: 'intro',
            title: 'Introduction',
            content: 'Intro content',
            order: 1,
            level: 2,
          },
        ],
      };

      vi.mocked(db.putItem).mockResolvedValue(undefined);

      const result = await ContentRepository.create(input);

      expect(result.meta?.title).toBe('Comprehensive Page');
      expect(result.navigation?.breadcrumbs).toHaveLength(2);
      expect(result.sections).toHaveLength(1);
      expect(result.sections?.[0].id).toBe('intro');
    });

    it('should reject invalid input', async () => {
      const invalidInput = {
        path: 'invalid-path', // Must start with /
        content: 'Test content',
        editorId: 'user123',
      };

      await expect(ContentRepository.create(invalidInput)).rejects.toThrow();
    });
  });

  describe('getById', () => {
    it('should retrieve content by id', async () => {
      const mockContent: ContentDynamoItem = {
        id: 'content_123',
        path: '/test',
        content: 'Test content',
        status: ContentStatus.PUBLISHED,
        visibility: ContentVisibility.PUBLIC,
        category: ContentCategory.GENERAL,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        createdBy: 'user123',
        updatedBy: 'user123',
        viewCount: 0,
        version: 'v1',
        isLatest: true,
        editedBy: ['user123'],
        PK: 'CONTENT#content_123',
        SK: '#METADATA',
        editorId: 'user123',
      };

      (getByPrimaryKey as any).mockResolvedValue(mockContent);

      const result = await ContentRepository.getById('content_123');

      expect(getByPrimaryKey).toHaveBeenCalledWith('CONTENT', 'content_123', '#METADATA');
      expect(result).toEqual(mockContent);
    });

    it('should return null for non-existent content', async () => {
      (getByPrimaryKey as any).mockResolvedValue(null);

      const result = await ContentRepository.getById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getByPath', () => {
    it('should retrieve content by path', async () => {
      const mockContent: ContentDynamoItem = {
        id: 'content_123',
        path: '/about',
        content: 'About content',
        status: ContentStatus.PUBLISHED,
        visibility: ContentVisibility.PUBLIC,
        category: ContentCategory.ABOUT,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        createdBy: 'user123',
        updatedBy: 'user123',
        viewCount: 0,
        version: 'v1',
        isLatest: true,
        editedBy: ['user123'],
        PK: 'CONTENT#content_123',
        SK: '#METADATA',
        editorId: 'user123',
      };

      (getByGlobalIndex as any).mockResolvedValue({
        items: [mockContent],
        nextToken: undefined,
        hasMore: false,
      });

      const result = await ContentRepository.getByPath('/about');

      expect(getByGlobalIndex).toHaveBeenCalledWith('GSI3', 'GSI3PK', 'CONTENT_PATH', {
        sortKeyName: 'GSI3SK',
        sortKeyValue: '/about',
        limit: 1,
      });
      expect(result).toEqual(mockContent);
    });

    it('should return null for non-existent path', async () => {
      (getByGlobalIndex as any).mockResolvedValue({
        items: [],
        nextToken: undefined,
        hasMore: false,
      });

      const result = await ContentRepository.getByPath('/non-existent');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update content with valid input', async () => {
      const existingContent: ContentDynamoItem = {
        id: 'content_123',
        path: '/test',
        content: 'Original content',
        status: ContentStatus.DRAFT,
        visibility: ContentVisibility.PUBLIC,
        category: ContentCategory.GENERAL,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        createdBy: 'user123',
        updatedBy: 'user123',
        viewCount: 5,
        version: 'v1',
        isLatest: true,
        editedBy: ['user123'],
        PK: 'CONTENT#content_123',
        SK: '#METADATA',
        editorId: 'user123',
      };

      const updatedContent = {
        ...existingContent,
        content: 'Updated content',
        status: ContentStatus.PUBLISHED,
        updatedBy: 'editor456',
        editedBy: ['user123', 'editor456'],
      };

      (getByPrimaryKey as any).mockResolvedValue(existingContent);
      (updateItem as any).mockResolvedValue(updatedContent);

      const updateInput = {
        id: 'content_123',
        editorId: 'editor456',
        content: 'Updated content',
        status: ContentStatus.PUBLISHED,
      };

      const result = await ContentRepository.update('content_123', updateInput);

      expect(updateItem).toHaveBeenCalledWith(
        {
          PK: 'CONTENT#content_123',
          SK: '#METADATA',
        },
        expect.objectContaining({
          id: 'content_123',
          editorId: 'editor456',
          content: 'Updated content',
          status: ContentStatus.PUBLISHED,
          updatedBy: 'editor456',
          editedBy: ['user123', 'editor456'],
          GSI2PK: 'CONTENT_STATUS#published',
        })
      );

      expect(result.content).toBe('Updated content');
      expect(result.status).toBe(ContentStatus.PUBLISHED);
    });

    it('should update GSI fields when category changes', async () => {
      const existingContent: ContentDynamoItem = {
        id: 'content_123',
        path: '/test',
        content: 'Test content',
        status: ContentStatus.PUBLISHED,
        visibility: ContentVisibility.PUBLIC,
        category: ContentCategory.GENERAL,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        createdBy: 'user123',
        updatedBy: 'user123',
        viewCount: 0,
        version: 'v1',
        isLatest: true,
        editedBy: ['user123'],
        PK: 'CONTENT#content_123',
        SK: '#METADATA',
        editorId: 'user123',
      };

      (getByPrimaryKey as any).mockResolvedValue(existingContent);
      (updateItem as any).mockResolvedValue({
        ...existingContent,
        category: ContentCategory.ABOUT,
      });

      const updateInput = {
        id: 'content_123',
        editorId: 'editor456',
        category: ContentCategory.ABOUT,
      };

      await ContentRepository.update('content_123', updateInput);

      expect(updateItem).toHaveBeenCalledWith(
        {
          PK: 'CONTENT#content_123',
          SK: '#METADATA',
        },
        expect.objectContaining({
          category: ContentCategory.ABOUT,
          GSI1PK: 'CONTENT_CATEGORY#about',
        })
      );
    });

    it('should update GSI fields when path changes', async () => {
      const existingContent: ContentDynamoItem = {
        id: 'content_123',
        path: '/old-path',
        content: 'Test content',
        status: ContentStatus.PUBLISHED,
        visibility: ContentVisibility.PUBLIC,
        category: ContentCategory.GENERAL,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        createdBy: 'user123',
        updatedBy: 'user123',
        viewCount: 0,
        version: 'v1',
        isLatest: true,
        editedBy: ['user123'],
        PK: 'CONTENT#content_123',
        SK: '#METADATA',
        editorId: 'user123',
      };

      (getByPrimaryKey as any).mockResolvedValue(existingContent);
      (updateItem as any).mockResolvedValue({
        ...existingContent,
        path: '/new-path',
      });

      const updateInput = {
        id: 'content_123',
        editorId: 'editor456',
        path: '/new-path',
      };

      await ContentRepository.update('content_123', updateInput);

      expect(updateItem).toHaveBeenCalledWith(
        {
          PK: 'CONTENT#content_123',
          SK: '#METADATA',
        },
        expect.objectContaining({
          path: '/new-path',
          GSI3SK: '/new-path',
        })
      );
    });

    it('should reject invalid update input', async () => {
      const invalidInput = {
        id: 'content_123',
        // Missing required editorId
        content: 'Updated content',
      };

      await expect(ContentRepository.update('content_123', invalidInput)).rejects.toThrow();
    });
  });
});
