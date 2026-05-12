import { z } from 'zod';

import { EntityRefSchema, TraditionSchema } from '../shared/schemas';

export const CreateRagaSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(5000).optional(),
  tradition: TraditionSchema.optional(),
  arohanam: z.string().max(200).optional(),
  avarohanam: z.string().max(200).optional(),
  alternateScales: z.array(z.string()).optional(),
  rasa: z.string().max(100).optional(),
  timeOfDay: z.enum(['morning', 'afternoon', 'evening', 'night', 'universal']).optional(),
  season: z.string().max(100).optional(),
  melaNumber: z.number().int().min(1).max(72).optional(),
  parentRaga: EntityRefSchema.optional(),
});

export const UpdateRagaSchema = CreateRagaSchema.partial();
