import { z } from 'zod';

import { YearSchema } from '../shared/schemas';
import { SocialLinkSchema } from '../social-link';

export const CreateArtistSchema = z.object({
  name: z.string().min(1).max(200),
  title: z.string().max(50).optional(),
  gurus: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string().min(1).max(200),
      })
    )
    .default([]),
  biography: z.string().max(10000).optional(),
  specialisations: z.array(z.string().min(1).max(100)).optional(),
  birthYear: YearSchema.optional(),
  birthPlace: z.string().max(200).optional(),
  website: z.string().url().optional(),
  socialLinks: z.array(SocialLinkSchema).optional(),
  activeYears: z.string().max(50).optional(),
});

export const UpdateArtistSchema = CreateArtistSchema.partial();
