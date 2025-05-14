import { z } from 'zod';
import { baseSearchParamsSchema, paginationParamsSchema } from './index';
import { AttributionType } from '@rasika/core';

// Composition search params
export const compositionSearchParamsSchema = baseSearchParamsSchema.extend({
  ragaId: z.string().optional(),
  talaId: z.string().optional(),
  artistId: z.string().optional(),
  language: z.string().optional(),
});

// Attribution search params
export const attributionSearchParamsSchema = z
  .object({
    compositionId: z.string().optional(),
    artistId: z.string().optional(),
    attributionType: z.nativeEnum(AttributionType).optional(),
  })
  .merge(paginationParamsSchema);
