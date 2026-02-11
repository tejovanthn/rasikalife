/**
 * Client-safe exports for Content domain
 * No Node.js or AWS dependencies - safe for browser import
 */

import type { z } from 'zod';
import type { CreateContentSchema, UpdateContentSchema } from './schema';

// Re-export schemas (Zod is browser-safe)
export { CreateContentSchema, UpdateContentSchema } from './schema';

// Export input types derived from schemas
export type CreateContentInput = z.infer<typeof CreateContentSchema>;
export type UpdateContentInput = z.infer<typeof UpdateContentSchema>;

// Export the Content type interface (browser-safe, no ElectroDB dependency)
export interface Content {
  id: string;
  path: string;
  content: string;
  category: string;
  status: string;
  visibility: string;
  editorId: string;
  meta: {
    title: string;
    description: string;
    keywords: string[];
    robots?: string;
  };
  navigation?: {
    breadcrumbs: Array<{ label: string; path: string }>;
    menuPlacement?: { section: string; order: number };
    relatedPages: Array<{ title: string; path: string; description?: string }>;
  };
  createdAt: string;
  updatedAt: string;
  version: number;
  publishedAt?: string;
}

// ContentWithRelations type
export interface ContentWithRelations extends Content {}
