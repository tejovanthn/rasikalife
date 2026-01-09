import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createContent, getContent, getContentByPath, updateContent, deleteContent } from './index';
import type { CreateContentInput } from './index';
import { ContentCategory, ContentStatus, ContentVisibility } from '../../types';

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
});
