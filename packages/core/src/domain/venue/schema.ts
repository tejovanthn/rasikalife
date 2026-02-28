import { z } from 'zod';

export const CreateVenueSchema = z.object({
  name: z.string().min(1).max(200),
  address: z
    .object({
      street: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      postalCode: z.string().optional(),
      country: z.string().optional(),
    })
    .optional(),
  mapLink: z.string().url().optional(),
  description: z.string().max(5000).optional(),
  venueType: z
    .enum(['concert-hall', 'auditorium', 'temple', 'open-air', 'community-hall', 'other'])
    .optional(),
  capacity: z.number().int().min(1).optional(),
  website: z.string().url().optional(),
  phone: z.string().max(30).optional(),
  socialLinks: z
    .array(
      z.object({
        platform: z.string().min(1).max(50),
        url: z.string().url(),
      })
    )
    .optional(),
});

export const UpdateVenueSchema = CreateVenueSchema.partial();
