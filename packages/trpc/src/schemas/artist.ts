import { z } from 'zod';
export { createArtistSchema, updateArtistSchema } from '@rasika/core';
import { baseSearchParamsSchema } from './index';

// Artist search params
export const artistSearchParamsSchema = baseSearchParamsSchema.extend({
  instrument: z.string().optional(),
  artistType: z
    .enum(['vocalist', 'instrumentalist', 'dancer', 'composer', 'group'] as const)
    .optional(),
  location: z
    .object({
      country: z.string().optional(),
      state: z.string().optional(),
      city: z.string().optional(),
    })
    .optional(),
});
