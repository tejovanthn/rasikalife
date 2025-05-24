import { createStringSchema, createArraySchema } from '../../utils';
import { z } from 'zod';
import { Tradition } from '../artist';

// Base schema for common tala fields
const talaBaseFields = {
  name: createStringSchema({ minLength: 1, maxLength: 200 }),
  alternativeNames: createArraySchema(createStringSchema({ maxLength: 200 })).optional(),
  type: createStringSchema({ maxLength: 100 }).optional(),
  aksharas: z.number().int().min(1).max(108),
  structure: createStringSchema({ maxLength: 500 }).optional(),
  notation: createStringSchema({ maxLength: 1000 }).optional(),
  examples: createArraySchema(createStringSchema({ maxLength: 200 })).optional(),
  tradition: z.nativeEnum(Tradition),
};

// Schema for creating a new tala
export const createTalaSchema = z.object({
  ...talaBaseFields,
  editorId: z.string(),
});

// Schema for updating a tala
export const updateTalaSchema = z.object({
  ...z.object(talaBaseFields).partial().shape,
  editorId: z.string(),
});

// Full schema including system fields
export const talaSchema = z.object({
  ...talaBaseFields,
  id: z.string(),
  version: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  viewCount: z.number().int().default(0),
  editedBy: z.array(z.string()),
  isLatest: z.boolean().default(true),
});

// Export inferred types
export type CreateTalaInput = z.infer<typeof createTalaSchema>;
export type UpdateTalaInput = z.infer<typeof updateTalaSchema>;
export type Tala = z.infer<typeof talaSchema>;
