import { z } from 'zod';

export const CreateAwardSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  rank: z.number().int().min(1).optional(),
  issuingOrganisationId: z.string().optional(),
  issuingOrganisationName: z.string().max(200).optional(),
  frequency: z.enum(['annual', 'biennial', 'occasional', 'one-time']).optional(),
  category: z
    .enum(['lifetime', 'young-artist', 'composer', 'accompanist', 'service', 'other'])
    .optional(),
});

export const UpdateAwardSchema = CreateAwardSchema.partial();
