import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContentCategory, ContentStatus, ContentVisibility } from '../../types';
import {
  createContent,
  deleteContent,
  getContent,
  getContentByPath,
  getContentsByCategory,
  listContents,
  listPublishedContents,
  updateContent,
} from './index';
import type { CreateContentInput } from './index';

// Mock dependencies
vi.mock('../../utils', () => ({
  generateId: vi.fn(() => 'test-content-id'),
}));

vi.mock('./entity', () => ({
  ContentEntity: {
    create: vi.fn(),
    get: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    query: {
      byPath: vi.fn(),
      byCategory: vi.fn(),
      list: vi.fn(),
      published: vi.fn(),
    },
  },
}));

describe('Content', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createContent', () => {
    it('should create content with generated ID', async () => {
      const input: CreateContentInput = {
        path: '/test',
        content: '# Test Content',
        category: ContentCategory.ABOUT,
        status: ContentStatus.PUBLISHED,
        visibility: ContentVisibility.PUBLIC,
        editorId: 'user-123',
        meta: {
          title: 'Test Page',
          description: 'A test page',
          keywords: ['test'],
        },
        navigation: {
          breadcrumbs: [{ label: 'Home', path: '/' }],
          relatedPages: [],
        },
      };

      const mockContent = {
        id: 'test-content-id',
        ...input,
        createdAt: '2025-01-09T00:00:00.000Z',
        updatedAt: '2025-01-09T00:00:00.000Z',
      };

      const { ContentEntity } = await import('./entity');
      vi.mocked(ContentEntity.create).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: mockContent }),
      } as any);

      const result = await createContent(input);

      expect(ContentEntity.create).toHaveBeenCalledWith({
        id: 'test-content-id',
        ...input,
      });
      expect(result).toEqual(mockContent);
    });
  });

  describe('getContent', () => {
    it('should return content when found', async () => {
      const mockContent = {
        id: 'test-content-id',
        path: '/test',
        content: '# Test Content',
        category: ContentCategory.ABOUT,
        status: ContentStatus.PUBLISHED,
        visibility: ContentVisibility.PUBLIC,
        editorId: 'user-123',
        meta: {
          title: 'Test Page',
          description: 'A test page',
          keywords: ['test'],
        },
        navigation: {
          breadcrumbs: [{ label: 'Home', path: '/' }],
          relatedPages: [],
        },
        createdAt: '2025-01-09T00:00:00.000Z',
        updatedAt: '2025-01-09T00:00:00.000Z',
      };

      const { ContentEntity } = await import('./entity');
      vi.mocked(ContentEntity.get).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: mockContent }),
      } as any);

      const result = await getContent('test-content-id');

      expect(ContentEntity.get).toHaveBeenCalledWith({ id: 'test-content-id' });
      expect(result).toMatchObject({
        id: 'test-content-id',
        path: '/test',
        content: '# Test Content',
      });
    });

    it('should return null when content not found', async () => {
      const { ContentEntity } = await import('./entity');
      vi.mocked(ContentEntity.get).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: null }),
      } as any);

      const result = await getContent('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('getContentByPath', () => {
    it('should return content by path', async () => {
      const mockContent = {
        id: 'test-content-id',
        path: '/test',
        content: '# Test Content',
        category: ContentCategory.ABOUT,
        status: ContentStatus.PUBLISHED,
        visibility: ContentVisibility.PUBLIC,
        editorId: 'user-123',
        meta: {
          title: 'Test Page',
          description: 'A test page',
          keywords: ['test'],
        },
        navigation: {
          breadcrumbs: [{ label: 'Home', path: '/' }],
          relatedPages: [],
        },
        createdAt: '2025-01-09T00:00:00.000Z',
        updatedAt: '2025-01-09T00:00:00.000Z',
      };

      const { ContentEntity } = await import('./entity');
      vi.mocked(ContentEntity.query.byPath).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: [mockContent] }),
      } as any);

      const result = await getContentByPath('/test');

      expect(ContentEntity.query.byPath).toHaveBeenCalledWith({ path: '/test' });
      expect(result?.path).toBe('/test');
    });
  });

  describe('getContentsByCategory', () => {
    it('should return contents by category', async () => {
      const mockContents = [
        {
          id: 'content-1',
          path: '/about',
          content: '# About',
          category: ContentCategory.ABOUT,
          status: ContentStatus.PUBLISHED,
          visibility: ContentVisibility.PUBLIC,
          editorId: 'user-123',
          meta: {
            title: 'About',
            description: 'About page',
            keywords: ['about'],
          },
          navigation: {
            breadcrumbs: [{ label: 'Home', path: '/' }],
            relatedPages: [],
          },
          createdAt: '2025-01-09T00:00:00.000Z',
          updatedAt: '2025-01-09T00:00:00.000Z',
        },
      ];

      const { ContentEntity } = await import('./entity');
      vi.mocked(ContentEntity.query.byCategory).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: mockContents }),
      } as any);

      const result = await getContentsByCategory(ContentCategory.ABOUT);

      expect(ContentEntity.query.byCategory).toHaveBeenCalledWith({
        category: ContentCategory.ABOUT,
      });
      expect(result).toEqual([
        {
          id: 'content-1',
          path: '/about',
          content: '# About',
          category: ContentCategory.ABOUT,
          status: ContentStatus.PUBLISHED,
          visibility: ContentVisibility.PUBLIC,
          editorId: 'user-123',
          meta: {
            title: 'About',
            description: 'About page',
            keywords: ['about'],
          },
          navigation: {
            breadcrumbs: [{ label: 'Home', path: '/' }],
            relatedPages: [],
          },
          createdAt: '2025-01-09T00:00:00.000Z',
          updatedAt: '2025-01-09T00:00:00.000Z',
        },
      ]);
    });
  });

  describe('updateContent', () => {
    it('should update content successfully', async () => {
      const updateInput = { content: 'Updated content' };
      const mockUpdatedContent = {
        id: 'test-content-id',
        path: '/test',
        content: 'Updated content',
        category: ContentCategory.ABOUT,
        status: ContentStatus.PUBLISHED,
        visibility: ContentVisibility.PUBLIC,
        editorId: 'user-123',
        meta: {
          title: 'Test Page',
          description: 'A test page',
          keywords: ['test'],
        },
        createdAt: '2025-01-09T00:00:00.000Z',
        updatedAt: '2025-01-09T01:00:00.000Z',
      };

      const { ContentEntity } = await import('./entity');
      vi.mocked(ContentEntity.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          go: vi.fn().mockResolvedValue({ data: mockUpdatedContent }),
        }),
      } as any);

      const result = await updateContent('test-content-id', updateInput);

      expect(ContentEntity.update).toHaveBeenCalledWith({ id: 'test-content-id' });
      expect(result).toEqual(mockUpdatedContent);
    });

    it('should throw error when update fails', async () => {
      const updateInput = { content: 'Updated content' };

      const { ContentEntity } = await import('./entity');
      vi.mocked(ContentEntity.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          go: vi.fn().mockResolvedValue({ data: null }),
        }),
      } as any);

      await expect(updateContent('test-content-id', updateInput)).rejects.toThrow(
        'Content test-content-id not found'
      );
    });
  });

  describe('deleteContent', () => {
    it('should delete content successfully', async () => {
      const { ContentEntity } = await import('./entity');
      vi.mocked(ContentEntity.delete).mockReturnValue({
        go: vi.fn().mockResolvedValue({}),
      } as any);

      await expect(deleteContent('test-content-id')).resolves.not.toThrow();

      expect(ContentEntity.delete).toHaveBeenCalledWith({ id: 'test-content-id' });
    });
  });

  describe('listContents', () => {
    it('should return paginated list of contents', async () => {
      const mockContents = [
        {
          id: 'content-1',
          path: '/about',
          content: '# About',
          category: ContentCategory.ABOUT,
          status: ContentStatus.PUBLISHED,
          visibility: ContentVisibility.PUBLIC,
          editorId: 'user-123',
          meta: {
            title: 'About',
            description: 'About page',
            keywords: ['about'],
          },
          navigation: {
            breadcrumbs: [{ label: 'Home', path: '/' }],
            relatedPages: [],
          },
          createdAt: '2025-01-09T00:00:00.000Z',
          updatedAt: '2025-01-09T00:00:00.000Z',
        },
      ];

      const { ContentEntity } = await import('./entity');
      vi.mocked(ContentEntity.query.list).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: mockContents, cursor: 'next-token' }),
      } as any);

      const result = await listContents({ limit: 10 });

      expect(ContentEntity.query.list).toHaveBeenCalledWith({});
      expect(result).toEqual({
        items: [
          {
            id: 'content-1',
            path: '/about',
            content: '# About',
            category: ContentCategory.ABOUT,
            status: ContentStatus.PUBLISHED,
            visibility: ContentVisibility.PUBLIC,
            editorId: 'user-123',
            meta: {
              title: 'About',
              description: 'About page',
              keywords: ['about'],
            },
            navigation: {
              breadcrumbs: [{ label: 'Home', path: '/' }],
              relatedPages: [],
            },
            createdAt: '2025-01-09T00:00:00.000Z',
            updatedAt: '2025-01-09T00:00:00.000Z',
          },
        ],
        nextToken: 'next-token',
        hasMore: true,
      });
    });
  });

  describe('listPublishedContents', () => {
    it('should return published and public contents', async () => {
      const mockContents = [
        {
          id: 'content-1',
          path: '/about',
          content: '# About',
          category: ContentCategory.ABOUT,
          status: 'published',
          visibility: 'public',
          editorId: 'user-123',
          meta: {
            title: 'About',
            description: 'About page',
            keywords: ['about'],
          },
          navigation: {
            breadcrumbs: [{ label: 'Home', path: '/' }],
            relatedPages: [],
          },
          createdAt: '2025-01-09T00:00:00.000Z',
          updatedAt: '2025-01-09T00:00:00.000Z',
        },
        {
          id: 'content-2',
          path: '/draft',
          content: '# Draft',
          category: ContentCategory.ABOUT,
          status: 'draft',
          visibility: 'public',
          editorId: 'user-123',
          meta: {
            title: 'Draft',
            description: 'Draft page',
            keywords: ['draft'],
          },
          navigation: {
            breadcrumbs: [{ label: 'Home', path: '/' }],
            relatedPages: [],
          },
          createdAt: '2025-01-09T00:00:00.000Z',
          updatedAt: '2025-01-09T00:00:00.000Z',
        },
      ];

      const { ContentEntity } = await import('./entity');
      vi.mocked(ContentEntity.query.list).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: mockContents }),
      } as any);

      const result = await listPublishedContents();

      expect(ContentEntity.query.list).toHaveBeenCalledWith({});
      expect(result).toEqual({
        items: [
          {
            id: 'content-1',
            path: '/about',
            content: '# About',
            category: ContentCategory.ABOUT,
            status: 'published',
            visibility: 'public',
            editorId: 'user-123',
            meta: {
              title: 'About',
              description: 'About page',
              keywords: ['about'],
            },
            navigation: {
              breadcrumbs: [{ label: 'Home', path: '/' }],
              relatedPages: [],
            },
            createdAt: '2025-01-09T00:00:00.000Z',
            updatedAt: '2025-01-09T00:00:00.000Z',
          },
        ],
        nextToken: undefined,
        hasMore: false,
      });
    });
  });
});
