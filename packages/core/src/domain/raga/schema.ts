import { createStringSchema, createArraySchema } from '@/utils';
import { z } from 'zod';
import { Tradition } from '../artist';

// Base schema for common raga fields
const ragaBaseFields = {
  name: createStringSchema({ minLength: 1, maxLength: 200 }),
  alternativeNames: createArraySchema(createStringSchema({ maxLength: 200 })).optional(),
  melakarta: z.number().int().min(1).max(72).optional(),
  janaka: createStringSchema({ maxLength: 200 }).optional(),
  arohanam: createStringSchema({ maxLength: 500 }).optional(),
  avarohanam: createStringSchema({ maxLength: 500 }).optional(),
  notes: createStringSchema({ maxLength: 5000 }).optional(),
  characteristicPhrases: createArraySchema(createStringSchema({ maxLength: 500 })).optional(),
  mood: createArraySchema(createStringSchema({ maxLength: 100 })).optional(),
  timeOfDay: createStringSchema({ maxLength: 100 }).optional(),
  history: createStringSchema({ maxLength: 5000 }).optional(),
  famousCompositions: createArraySchema(createStringSchema({ maxLength: 200 })).optional(),
  tradition: z.nativeEnum(Tradition),
};

// Schema for creating a new raga
export const createRagaSchema = z.object({
  ...ragaBaseFields,
  editorId: z.string(),
});

// Schema for updating a raga
export const updateRagaSchema = z.object({
  ...z.object(ragaBaseFields).partial().shape,
  editorId: z.string(),
});

// Full schema including system fields
export const ragaSchema = z.object({
  ...ragaBaseFields,
  id: z.string(),
  version: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  viewCount: z.number().int().default(0),
  editedBy: z.array(z.string()),
  isLatest: z.boolean().default(true),
});

// Export inferred types
export type CreateRagaInput = z.infer<typeof createRagaSchema>;
export type UpdateRagaInput = z.infer<typeof updateRagaSchema>;
export type Raga = z.infer<typeof ragaSchema>;
