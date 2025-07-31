/**
 * Content service tests
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContentRepository } from './repository';
import { ContentCategory, ContentStatus, ContentVisibility } from './schema';
import { ContentService } from './service';

// Mock the repository
vi.mock('./repository', () => ({
  ContentRepository: {
    create: vi.fn(),
    getById: vi.fn(),
    getByPath: vi.fn(),
    update: vi.fn(),
  },
}));

describe('ContentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should create content when path does not exist', async () => {
      const input = {
        path: '/new-content',
        content: 'New content body',
        editorId: 'user123',
      };

      const mockCreatedContent = {
        id: 'content_123',
        path: '/new-content',
        content: 'New content body',
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

      vi.mocked(ContentRepository.getByPath).mockResolvedValue(null);
      vi.mocked(ContentRepository.create).mockResolvedValue(mockCreatedContent);

      const result = await ContentService.create(input);

      expect(ContentRepository.getByPath).toHaveBeenCalledWith('/new-content');
      expect(ContentRepository.create).toHaveBeenCalledWith(input);
      expect(result.path).toBe('/new-content');
      expect(result.content).toBe('New content body');
    });

    it('should throw error when path already exists', async () => {
      const input = {
        path: '/existing-content',
        content: 'Content body',
        editorId: 'user123',
      };

      const existingContent = {
        id: 'existing_123',
        path: '/existing-content',
        content: 'Existing content',
        // ... other fields
      };

      vi.mocked(ContentRepository.getByPath).mockResolvedValue(existingContent as any);

      await expect(ContentService.create(input)).rejects.toThrow(
        "Content with path '/existing-content' already exists"
      );

      expect(ContentRepository.getByPath).toHaveBeenCalledWith('/existing-content');
      expect(ContentRepository.create).not.toHaveBeenCalled();
    });

    it('should handle auxiliary content properly', async () => {
      const input = {
        path: '/rich-content',
        content: '# Rich Content\n\nWith metadata',
        editorId: 'creator',
        meta: {
          title: 'Rich Content Page',
          description: 'A page with rich metadata',
        },
        navigation: {
          breadcrumbs: [
            { label: 'Home', path: '/' },
            { label: 'Rich', path: '/rich-content' },
          ],
        },
        status: ContentStatus.DRAFT,
        category: ContentCategory.RESOURCE,
      };

      const mockCreatedContent = {
        ...input,
        id: 'content_456',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        createdBy: 'creator',
        updatedBy: 'creator',
        viewCount: 0,
        version: 'v1',
        isLatest: true,
        editedBy: ['creator'],
        visibility: ContentVisibility.PUBLIC,
        PK: 'CONTENT#content_456',
        SK: '#METADATA',
      };

      vi.mocked(ContentRepository.getByPath).mockResolvedValue(null);
      vi.mocked(ContentRepository.create).mockResolvedValue(mockCreatedContent);

      const result = await ContentService.create(input);

      expect(result.meta?.title).toBe('Rich Content Page');
      expect(result.navigation?.breadcrumbs).toHaveLength(2);
      expect(result.status).toBe(ContentStatus.DRAFT);
      expect(result.category).toBe(ContentCategory.RESOURCE);
    });

    it('should reject invalid path format', async () => {
      const input = {
        path: 'invalid-path', // Must start with /
        content: 'Content body',
        editorId: 'user123',
      };

      await expect(ContentService.create(input)).rejects.toThrow();
    });
  });

  describe('getById', () => {
    it('should return content when found', async () => {
      const mockContent = {
        id: 'content_123',
        path: '/test-content',
        content: 'Test content',
        status: ContentStatus.PUBLISHED,
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

      vi.mocked(ContentRepository.getById).mockResolvedValue(mockContent);

      const result = await ContentService.getById('content_123');

      expect(ContentRepository.getById).toHaveBeenCalledWith('content_123');
      expect(result?.id).toBe('content_123');
      expect(result?.path).toBe('/test-content');
    });

    it('should return null when not found', async () => {
      vi.mocked(ContentRepository.getById).mockResolvedValue(null);

      const result = await ContentService.getById('non-existent');

      expect(ContentRepository.getById).toHaveBeenCalledWith('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('getByPath', () => {
    it('should return content when found', async () => {
      const mockContent = {
        id: 'content_456',
        path: '/about',
        content: 'About content',
        status: ContentStatus.PUBLISHED,
        visibility: ContentVisibility.PUBLIC,
        category: ContentCategory.ABOUT,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        createdBy: 'admin',
        updatedBy: 'admin',
        viewCount: 10,
        version: 'v1',
        isLatest: true,
        editedBy: ['admin'],
        PK: 'CONTENT#content_456',
        SK: '#METADATA',
        editorId: 'admin',
      };

      vi.mocked(ContentRepository.getByPath).mockResolvedValue(mockContent);

      const result = await ContentService.getByPath('/about');

      expect(ContentRepository.getByPath).toHaveBeenCalledWith('/about');
      expect(result?.path).toBe('/about');
      expect(result?.category).toBe(ContentCategory.ABOUT);
    });

    it('should return null when not found', async () => {
      vi.mocked(ContentRepository.getByPath).mockResolvedValue(null);

      const result = await ContentService.getByPath('/non-existent');

      expect(ContentRepository.getByPath).toHaveBeenCalledWith('/non-existent');
      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update content successfully', async () => {
      const updateInput = {
        id: 'content_123',
        editorId: 'editor456',
        content: 'Updated content',
        status: ContentStatus.PUBLISHED,
      };

      const mockUpdatedContent = {
        id: 'content_123',
        path: '/test-content',
        content: 'Updated content',
        status: ContentStatus.PUBLISHED,
        visibility: ContentVisibility.PUBLIC,
        category: ContentCategory.GENERAL,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
        createdBy: 'user123',
        updatedBy: 'editor456',
        viewCount: 0,
        version: 'v1',
        isLatest: true,
        editedBy: ['user123', 'editor456'],
        PK: 'CONTENT#content_123',
        SK: '#METADATA',
        editorId: 'editor456',
      };

      vi.mocked(ContentRepository.update).mockResolvedValue(mockUpdatedContent);

      const result = await ContentService.update('content_123', updateInput);

      expect(ContentRepository.update).toHaveBeenCalledWith('content_123', updateInput);
      expect(result.content).toBe('Updated content');
      expect(result.status).toBe(ContentStatus.PUBLISHED);
      expect(result.updatedBy).toBe('editor456');
    });

    it('should handle auxiliary content updates', async () => {
      const updateInput = {
        id: 'content_789',
        editorId: 'editor789',
        meta: {
          title: 'Updated Title',
          description: 'Updated description',
        },
        navigation: {
          breadcrumbs: [
            { label: 'Home', path: '/' },
            { label: 'Updated', path: '/updated' },
          ],
        },
      };

      const mockUpdatedContent = {
        id: 'content_789',
        path: '/test-page',
        content: 'Original content',
        meta: {
          title: 'Updated Title',
          description: 'Updated description',
        },
        navigation: {
          breadcrumbs: [
            { label: 'Home', path: '/' },
            { label: 'Updated', path: '/updated' },
          ],
        },
        status: ContentStatus.PUBLISHED,
        visibility: ContentVisibility.PUBLIC,
        category: ContentCategory.GENERAL,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-03T00:00:00.000Z',
        createdBy: 'creator',
        updatedBy: 'editor789',
        viewCount: 0,
        version: 'v1',
        isLatest: true,
        editedBy: ['creator', 'editor789'],
        PK: 'CONTENT#content_789',
        SK: '#METADATA',
        editorId: 'editor789',
      };

      vi.mocked(ContentRepository.update).mockResolvedValue(mockUpdatedContent);

      const result = await ContentService.update('content_789', updateInput);

      expect(result.meta?.title).toBe('Updated Title');
      expect(result.navigation?.breadcrumbs).toHaveLength(2);
      expect(result.updatedBy).toBe('editor789');
    });
  });
});
