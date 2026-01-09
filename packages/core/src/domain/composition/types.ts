import { z } from 'zod';
import { CreateCompositionSchema, UpdateCompositionSchema } from './schema';

// Type inference from schemas
export type CreateCompositionInput = z.infer<typeof CreateCompositionSchema>;
export type UpdateCompositionInput = z.infer<typeof UpdateCompositionSchema>;

// Re-export types from entities
export type { Composition } from '../../db/entities';
