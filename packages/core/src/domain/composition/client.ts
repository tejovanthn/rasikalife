/**
 * Client-safe exports for Composition domain
 * No Node.js or AWS dependencies - safe for browser import
 */

import type { z } from 'zod';
import type { CreateCompositionSchema, UpdateCompositionSchema } from './schema';

// Re-export schemas (Zod is browser-safe)
export { CreateCompositionSchema, UpdateCompositionSchema } from './schema';

// Export input types derived from schemas
export type CreateCompositionInput = z.infer<typeof CreateCompositionSchema>;
export type UpdateCompositionInput = z.infer<typeof UpdateCompositionSchema>;

// Lyrics type (backward compatibility)
export type Lyrics = Array<{
  type: string;
  order: number;
  text: string;
  number?: number;
  ragaName?: string;
}>;

// Export the Composition type interface (browser-safe, no ElectroDB dependency)
export interface Composition {
  id: string;
  title: string;
  composerId: string;
  composer: { id: string; name: string };
  language: string;
  lyricsV1: Lyrics;
  ragas: Array<{ id: string; name: string }>;
  talas: Array<{ id: string; name: string }>;
  sourceAttribution?: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  lastEditedBy?: string;
}

// CompositionWithRelations type
export interface CompositionWithRelations {
  id: string;
  title: string;
  composer: { id: string; name: string };
  language: string;
  lyricsV1: Lyrics;
  ragas: Array<{ id: string; name: string }>;
  talas: Array<{ id: string; name: string }>;
  sourceAttribution?: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  lastEditedBy?: string;
}
