import { z } from 'zod';

import { SocialLinkSchema } from '../social-link';
import { AddressSchema, YearSchema } from '../shared/schemas';

export const CreateVenueSchema = z.object({
  name: z.string().min(1).max(200),
  address: AddressSchema.optional(),
  mapLink: z.string().url().optional(),
  description: z.string().max(5000).optional(),
  venueType: z
    .enum([
      'auditorium',
      'sabha-hall',
      'temple-hall',
      'open-air',
      'pandal',
      'terrace',
      'community-hall',
      'heritage-building',
      'university',
      'other',
    ])
    .optional(),
  capacity: z.number().int().min(1).optional(),
  website: z.string().url().optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email().optional(),
  photoUrl: z.string().url().optional(),
  photoUploadId: z.string().optional(),
  amenities: z
    .array(
      z.enum([
        'ac',
        'parking',
        'floor-seating',
        'chair-seating',
        'green-room',
        'canteen',
        'wheelchair-accessible',
        'hearing-loop',
        'elevator',
        'restrooms',
        'metro-nearby',
        'bus-stop-nearby',
        'sound-system',
        'live-streaming',
        'library',
        'other',
      ])
    )
    .optional(),
  nearestTransit: z.string().max(200).optional(),
  foundedYear: YearSchema.optional(),
  socialLinks: z.array(SocialLinkSchema).optional(),
});

export const UpdateVenueSchema = CreateVenueSchema.partial();
