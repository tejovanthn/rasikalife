import { createStringSchema, createArraySchema } from '../../utils';
import { z } from 'zod';
import { Tradition } from '../artist';
import { AttributionConfidence, AttributionType } from './types';

// Base schema for common composition fields
const compositionBaseFields = {
  title: createStringSchema({ minLength: 1, maxLength: 300 }),
  canonicalTitle: createStringSchema({ maxLength: 300 }).optional(),
  alternativeTitles: createArraySchema(createStringSchema({ maxLength: 300 })).optional(),
  language: createStringSchema({ maxLength: 50 }),
  verses: createStringSchema({ maxLength: 5000 }).optional(),
  meaning: createStringSchema({ maxLength: 5000 }).optional(),
  notation: createStringSchema({ maxLength: 5000 }).optional(),
  audioSamples: createArraySchema(z.string().url()).optional(),
  videoSamples: createArraySchema(z.string().url()).optional(),
  sourceAttribution: createStringSchema({ maxLength: 500 }).optional(),
  tradition: z.nativeEnum(Tradition),
  ragaIds: createArraySchema(z.string()).optional(),
  talaIds: createArraySchema(z.string()).optional(),
};

// Schema for creating a new composition
export const createCompositionSchema = z.object({
  ...compositionBaseFields,
  editorId: z.string(),
});

// Schema for updating a composition
export const updateCompositionSchema = z.object({
  ...z.object(compositionBaseFields).partial().shape,
  editorId: z.string(),
});

// Full schema including system fields
export const compositionSchema = z.object({
  ...compositionBaseFields,
  id: z.string(),
  version: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  editedBy: z.array(z.string()),
  viewCount: z.number().int().default(0),
  favoriteCount: z.number().int().default(0),
  popularityScore: z.number().default(0),
  isLatest: z.boolean().default(true),
});

// Schema for creating a composition attribution
export const createAttributionSchema = z.object({
  compositionId: z.string(),
  artistId: z.string(),
  attributionType: z.nativeEnum(AttributionType),
  confidence: z.nativeEnum(AttributionConfidence),
  source: createStringSchema({ maxLength: 500 }).optional(),
  notes: createStringSchema({ maxLength: 1000 }).optional(),
  addedBy: z.string(),
});

// Schema for updating a composition attribution
export const updateAttributionSchema = createAttributionSchema.partial().required({
  compositionId: true,
  artistId: true,
});

// Full schema for attribution including system fields
export const attributionSchema = createAttributionSchema.extend({
  createdAt: z.string(),
  verifiedBy: z.array(z.string()).optional(),
});

// Export inferred types
export type CreateCompositionInput = z.infer<typeof createCompositionSchema>;
export type UpdateCompositionInput = z.infer<typeof updateCompositionSchema>;
export type Composition = z.infer<typeof compositionSchema>;

export type CreateAttributionInput = z.infer<typeof createAttributionSchema>;
export type UpdateAttributionInput = z.infer<typeof updateAttributionSchema>;
export type CompositionAttribution = z.infer<typeof attributionSchema>;
