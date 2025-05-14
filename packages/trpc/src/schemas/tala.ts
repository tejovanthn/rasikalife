import { z } from 'zod';
import { baseSearchParamsSchema } from './index';

// Tala search params
export const talaSearchParamsSchema = baseSearchParamsSchema.extend({
  aksharas: z.number().optional(),
  type: z.string().optional(),
});
