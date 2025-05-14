import { z } from 'zod';
import { Tradition } from '@rasika/core';

// Base pagination params
export const paginationParamsSchema = z.object({
  limit: z.number().min(1).max(100).default(20),
  nextToken: z.string().optional(),
});

// Base search params schema
export const baseSearchParamsSchema = z
  .object({
    query: z.string().optional(),
    tradition: z.nativeEnum(Tradition).optional(),
  })
  .merge(paginationParamsSchema);

// ID param with view tracking option
export const idWithViewTrackingSchema = z.object({
  id: z.string(),
  trackView: z.boolean().default(true),
  version: z.string().optional(),
});
