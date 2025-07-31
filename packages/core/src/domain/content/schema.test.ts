/**
 * Content schema tests
 */
import { describe, expect, it } from 'vitest';
import {
  ContentCategory,
  ContentStatus,
  ContentVisibility,
  contentMetaSchema,
  contentNavigationSchema,
  contentSchema,
  contentSectionSchema,
  createContentSchema,
  updateContentSchema,
} from './schema';

describe('Content Schema', () => {
  describe('createContentSchema', () => {
    it('should validate valid content creation input', () => {
      const validInput = {
        path: '/test-path',
        content: 'Test content',
        editorId: 'editor123',
      };

      const result = createContentSchema.parse(validInput);
      expect(result.path).toBe('/test-path');
      expect(result.content).toBe('Test content');
      expect(result.editorId).toBe('editor123');
      expect(result.status).toBe(ContentStatus.PUBLISHED);
      expect(result.visibility).toBe(ContentVisibility.PUBLIC);
      expect(result.category).toBe(ContentCategory.GENERAL);
      expect(result.version).toBe('v1');
      expect(result.isLatest).toBe(true);
      expect(result.editedBy).toEqual([]);
      expect(result.viewCount).toBe(0);
    });

    it('should validate content with full auxiliary data', () => {
      const validInput = {
        path: '/about',
        content: '# About Us\n\nWe are awesome.',
        editorId: 'editor123',
        meta: {
          title: 'About Us',
          description: 'Learn about our company',
          keywords: ['about', 'company'],
        },
        navigation: {
          breadcrumbs: [
            { label: 'Home', path: '/' },
            { label: 'About', path: '/about' },
          ],
        },
        sections: [
          {
            id: 'intro',
            title: 'Introduction',
            content: 'Welcome to our site',
            order: 1,
            level: 2,
          },
        ],
        status: ContentStatus.DRAFT,
        category: ContentCategory.ABOUT,
        tags: ['info', 'company'],
      };

      const result = createContentSchema.parse(validInput);
      expect(result.path).toBe('/about');
      expect(result.meta?.title).toBe('About Us');
      expect(result.navigation?.breadcrumbs).toHaveLength(2);
      expect(result.sections).toHaveLength(1);
      expect(result.status).toBe(ContentStatus.DRAFT);
      expect(result.category).toBe(ContentCategory.ABOUT);
    });

    it('should reject invalid path format', () => {
      const invalidInput = {
        path: 'invalid-path', // Must start with /
        content: 'Test content',
        editorId: 'editor123',
      };

      expect(() => createContentSchema.parse(invalidInput)).toThrow();
    });

    it('should reject path with uppercase letters', () => {
      const invalidInput = {
        path: '/Invalid-Path',
        content: 'Test content',
        editorId: 'editor123',
      };

      expect(() => createContentSchema.parse(invalidInput)).toThrow();
    });

    it('should reject empty content', () => {
      const invalidInput = {
        path: '/test',
        content: '',
        editorId: 'editor123',
      };

      expect(() => createContentSchema.parse(invalidInput)).toThrow();
    });

    it('should reject missing editorId', () => {
      const invalidInput = {
        path: '/test',
        content: 'Test content',
      };

      expect(() => createContentSchema.parse(invalidInput)).toThrow();
    });
  });

  describe('updateContentSchema', () => {
    it('should validate partial update input', () => {
      const validInput = {
        id: 'content123',
        editorId: 'editor456',
        content: 'Updated content',
        status: ContentStatus.PUBLISHED,
      };

      const result = updateContentSchema.parse(validInput);
      expect(result.id).toBe('content123');
      expect(result.editorId).toBe('editor456');
      expect(result.content).toBe('Updated content');
      expect(result.status).toBe(ContentStatus.PUBLISHED);
    });

    it('should require id and editorId', () => {
      const invalidInput = {
        content: 'Updated content',
      };

      expect(() => updateContentSchema.parse(invalidInput)).toThrow();
    });
  });

  describe('contentMetaSchema', () => {
    it('should validate SEO metadata', () => {
      const validMeta = {
        title: 'Page Title',
        description: 'Page description',
        keywords: ['seo', 'metadata'],
        ogTitle: 'OG Title',
        twitterCard: 'summary' as const,
      };

      const result = contentMetaSchema.parse(validMeta);
      expect(result.title).toBe('Page Title');
      expect(result.twitterCard).toBe('summary');
    });

    it('should reject invalid URL in canonical', () => {
      const invalidMeta = {
        canonical: 'not-a-url',
      };

      expect(() => contentMetaSchema.parse(invalidMeta)).toThrow();
    });

    it('should reject too many keywords', () => {
      const invalidMeta = {
        keywords: Array(25).fill('keyword'), // Max is 20
      };

      expect(() => contentMetaSchema.parse(invalidMeta)).toThrow();
    });
  });

  describe('contentNavigationSchema', () => {
    it('should validate navigation structure', () => {
      const validNav = {
        breadcrumbs: [
          { label: 'Home', path: '/' },
          { label: 'About', path: '/about' },
        ],
        menuPlacement: {
          section: 'main',
          order: 1,
        },
        parentPath: '/parent',
      };

      const result = contentNavigationSchema.parse(validNav);
      expect(result.breadcrumbs).toHaveLength(2);
      expect(result.menuPlacement?.order).toBe(1);
    });

    it('should reject too many breadcrumbs', () => {
      const invalidNav = {
        breadcrumbs: Array(15).fill({ label: 'Test', path: '/test' }), // Max is 10
      };

      expect(() => contentNavigationSchema.parse(invalidNav)).toThrow();
    });
  });

  describe('contentSectionSchema', () => {
    it('should validate content sections', () => {
      const validSection = {
        id: 'section1',
        title: 'Section Title',
        content: 'Section content',
        order: 1,
        level: 2,
      };

      const result = contentSectionSchema.parse(validSection);
      expect(result.id).toBe('section1');
      expect(result.level).toBe(2);
    });

    it('should reject invalid heading level', () => {
      const invalidSection = {
        id: 'section1',
        title: 'Section Title',
        content: 'Section content',
        order: 1,
        level: 7, // Max is 6
      };

      expect(() => contentSectionSchema.parse(invalidSection)).toThrow();
    });
  });

  describe('contentSchema (full entity)', () => {
    it('should validate complete content entity', () => {
      const validContent = {
        id: 'content123',
        path: '/test-content',
        content: 'Full content',
        status: ContentStatus.PUBLISHED,
        visibility: ContentVisibility.PUBLIC,
        category: ContentCategory.GENERAL,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        createdBy: 'creator123',
        updatedBy: 'updater456',
        viewCount: 0,
        version: 'v1',
        isLatest: true,
        editedBy: ['editor1', 'editor2'],
        editorId: 'editor123',
      };

      const result = contentSchema.parse(validContent);
      expect(result.id).toBe('content123');
      expect(result.editedBy).toHaveLength(2);
    });

    it('should reject negative view count', () => {
      const invalidContent = {
        id: 'content123',
        path: '/test-content',
        content: 'Full content',
        status: ContentStatus.PUBLISHED,
        visibility: ContentVisibility.PUBLIC,
        category: ContentCategory.GENERAL,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        createdBy: 'creator123',
        updatedBy: 'updater456',
        viewCount: -1, // Invalid
        version: 'v1',
        isLatest: true,
        editedBy: ['editor1'],
        editorId: 'editor123',
      };

      expect(() => contentSchema.parse(invalidContent)).toThrow();
    });
  });

  describe('Enums', () => {
    it('should have correct ContentStatus values', () => {
      expect(ContentStatus.DRAFT).toBe('draft');
      expect(ContentStatus.PUBLISHED).toBe('published');
      expect(ContentStatus.ARCHIVED).toBe('archived');
    });

    it('should have correct ContentVisibility values', () => {
      expect(ContentVisibility.PUBLIC).toBe('public');
      expect(ContentVisibility.MEMBERS).toBe('members');
      expect(ContentVisibility.ADMIN).toBe('admin');
    });

    it('should have correct ContentCategory values', () => {
      expect(ContentCategory.LEGAL).toBe('legal');
      expect(ContentCategory.ABOUT).toBe('about');
      expect(ContentCategory.HELP).toBe('help');
      expect(ContentCategory.COMMUNITY).toBe('community');
      expect(ContentCategory.RESOURCE).toBe('resource');
      expect(ContentCategory.GENERAL).toBe('general');
    });
  });
});
