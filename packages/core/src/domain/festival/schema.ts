import { z } from 'zod';

import { SponsorSchema } from '../shared/schemas';

export const CreateFestivalSchema = z.object({
  name: z.string().min(1).max(300),
  description: z.string().max(5000).optional(),
  startDate: z.string(),
  endDate: z.string(),
  posterUrl: z.string().url().optional(),
  posterUploadId: z.string().optional(),
  organiserId: z.string().optional(),
  organiserName: z.string().optional(),
  tags: z.array(z.string()).default([]),
  sponsors: z.array(SponsorSchema).nullish().transform(v => v ?? undefined),
});

export const UpdateFestivalSchema = CreateFestivalSchema.partial();
