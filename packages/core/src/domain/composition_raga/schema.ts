import { z } from 'zod';

export const CreateCompositionRagaSchema = z.object({
  compositionId: z.string().min(1),
  ragaId: z.string().min(1),
});

export type CreateCompositionRagaInput = z.infer<typeof CreateCompositionRagaSchema>;
