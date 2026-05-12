import { z } from 'zod';

import { SocialLinkSchema } from '../social-link';
import { AddressSchema, YearSchema } from '../shared/schemas';

export const CreateOrganiserSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  organisationType: z.enum(['sabha', 'trust', 'ngo', 'temple', 'university', 'other']).optional(),
  city: z.string().max(100).optional(),
  address: AddressSchema.optional(),
  website: z.string().url().optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email().optional(),
  socialLinks: z.array(SocialLinkSchema).optional(),
  foundedYear: YearSchema.optional(),
  logoUrl: z.string().url().optional(),
  logoUploadId: z.string().optional(),
  tags: z
    .array(
      z.enum([
        'carnatic',
        'hindustani',
        'bharatanatyam',
        'dance',
        'instrumental',
        'jugalbandi',
        'lecture-demo',
        'music-school',
        'music-competition',
        'award-conferring',
        'publication',
        'free-entry',
        'ticketed',
        'festival-organiser',
        'year-round',
        'charitable',
        'other',
      ])
    )
    .optional(),
  venueId: z.string().optional(),
  venueName: z.string().max(200).optional(),
});

export const UpdateOrganiserSchema = CreateOrganiserSchema.partial();
