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
});

export const UpdateVenueSchema = CreateVenueSchema.partial();
