import { z } from 'zod';
import { baseSearchParamsSchema } from './index';

// Raga search params
export const ragaSearchParamsSchema = baseSearchParamsSchema.extend({
  melakarta: z.number().optional(),
  mood: z.string().optional(),
  timeOfDay: z.string().optional(),
});
