/**
 * Content domain Zod schemas - following artist domain pattern
 */
import { z } from 'zod';
import { createArraySchema, createStringSchema } from '../../utils';

// Content enums
export enum ContentStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

export enum ContentVisibility {
  PUBLIC = 'public',
  MEMBERS = 'members',
  ADMIN = 'admin',
}

export enum ContentCategory {
  LEGAL = 'legal',
  ABOUT = 'about',
  HELP = 'help',
  COMMUNITY = 'community',
  RESOURCE = 'resource',
  GENERAL = 'general',
}

// Auxiliary content schemas
export const contentMetaSchema = z
  .object({
    title: createStringSchema({ minLength: 1, maxLength: 200 }).optional(),
    description: createStringSchema({ minLength: 1, maxLength: 500 }).optional(),
    keywords: createArraySchema(createStringSchema({ maxLength: 50 }), { maxItems: 20 }).optional(),
    author: createStringSchema({ maxLength: 100 }).optional(),
    canonical: z.string().url().optional(),
    robots: createStringSchema({ maxLength: 100 }).optional(),

    // Open Graph
    ogTitle: createStringSchema({ minLength: 1, maxLength: 200 }).optional(),
    ogDescription: createStringSchema({ minLength: 1, maxLength: 500 }).optional(),
    ogImage: z.string().url().optional(),
    ogType: createStringSchema({ maxLength: 50 }).optional(),

    // Twitter Card
    twitterCard: z.enum(['summary', 'summary_large_image', 'app', 'player']).optional(),
    twitterTitle: createStringSchema({ minLength: 1, maxLength: 200 }).optional(),
    twitterDescription: createStringSchema({ minLength: 1, maxLength: 500 }).optional(),
    twitterImage: z.string().url().optional(),
  })
  .strict();

export const breadcrumbSchema = z
  .object({
    label: createStringSchema({ minLength: 1, maxLength: 100 }),
    path: createStringSchema({ minLength: 1, maxLength: 500 }),
  })
  .strict();

export const relatedPageSchema = z
  .object({
    title: createStringSchema({ minLength: 1, maxLength: 200 }),
    path: createStringSchema({ minLength: 1, maxLength: 500 }),
    description: createStringSchema({ minLength: 1, maxLength: 300 }).optional(),
  })
  .strict();

export const menuPlacementSchema = z
  .object({
    section: createStringSchema({ minLength: 1, maxLength: 50 }),
    order: z.number().int().min(0).max(9999),
    label: createStringSchema({ minLength: 1, maxLength: 100 }).optional(),
  })
  .strict();

export const contentNavigationSchema = z
  .object({
    breadcrumbs: createArraySchema(breadcrumbSchema, { maxItems: 10 }).optional(),
    relatedPages: createArraySchema(relatedPageSchema, { maxItems: 20 }).optional(),
    menuPlacement: menuPlacementSchema.optional(),
    parentPath: createStringSchema({ minLength: 1, maxLength: 500 }).optional(),
    childPaths: createArraySchema(createStringSchema({ maxLength: 500 }), {
      maxItems: 50,
    }).optional(),
  })
  .strict();

export const contentSectionSchema = z
  .object({
    id: createStringSchema({ minLength: 1, maxLength: 100 }),
    title: createStringSchema({ minLength: 1, maxLength: 200 }),
    content: createStringSchema({ minLength: 1 }),
    order: z.number().int().min(0).max(9999),
    level: z.number().int().min(1).max(6),
  })
  .strict();

// Content creation schema - what's required when creating new content
export const createContentSchema = z.object({
  path: z
    .string()
    .min(1)
    .max(500)
    .regex(
      /^\/[a-z0-9\-\/]*$/,
      'Path must start with / and contain only lowercase letters, numbers, hyphens, and forward slashes'
    ),
  content: createStringSchema({ minLength: 1 }),

  // Auxiliary content (optional)
  meta: contentMetaSchema.optional(),
  navigation: contentNavigationSchema.optional(),
  sections: createArraySchema(contentSectionSchema, { maxItems: 50 }).optional(),

  // Management (with defaults)
  status: z.nativeEnum(ContentStatus).default(ContentStatus.PUBLISHED),
  visibility: z.nativeEnum(ContentVisibility).default(ContentVisibility.PUBLIC),
  category: z.nativeEnum(ContentCategory).default(ContentCategory.GENERAL),
  tags: createArraySchema(createStringSchema({ maxLength: 50 }), { maxItems: 20 }).optional(),

  // Editor info
  editorId: z.string().min(1),

  // Optional publish date
  publishedAt: z.string().datetime().optional(),
});

// Update schema - partial version for updates
export const updateContentSchema = createContentSchema.partial().extend({
  id: z.string(),
  editorId: z.string().min(1), // Required for updates
});

// Full content schema including system fields
export const contentSchema = createContentSchema.extend({
  id: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  createdBy: z.string().min(1),
  updatedBy: z.string().min(1),
  viewCount: z.number().int().min(0).default(0),
  version: z.string().default('v1'),
  isLatest: z.boolean().default(true),
  editedBy: z.array(z.string().min(1)).default([]),
});

// Export type inference
export type Content = z.infer<typeof contentSchema>;
