import { z } from 'zod';

export const CreateCompositionTalaSchema = z.object({
  compositionId: z.string().min(1),
  talaId: z.string().min(1),
});

export type CreateCompositionTalaInput = z.infer<typeof CreateCompositionTalaSchema>;
