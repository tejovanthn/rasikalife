import { z } from 'zod';

export const CreateRagaSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(5000).optional(),
  tradition: z.enum(['carnatic', 'hindustani', 'both']).optional(),
  arohanam: z.string().max(200).optional(),
  avarohanam: z.string().max(200).optional(),
  rasa: z.string().max(100).optional(),
  timeOfDay: z.enum(['morning', 'afternoon', 'evening', 'night', 'universal']).optional(),
  season: z.string().max(100).optional(),
  melaNumber: z.number().int().min(1).max(72).optional(),
  parentRaga: z
    .object({
      id: z.string().min(1),
      name: z.string().min(1),
    })
    .optional(),
});

export const UpdateRagaSchema = CreateRagaSchema.partial();
