import { z } from 'zod';

export const CreateOrganiserSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  organisationType: z.enum(['sabha', 'trust', 'ngo', 'temple', 'university', 'other']).optional(),
  city: z.string().max(100).optional(),
  address: z
    .object({
      street: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      postalCode: z.string().optional(),
      country: z.string().optional(),
    })
    .optional(),
  website: z.string().url().optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email().optional(),
  socialLinks: z
    .array(
      z.object({
        platform: z.string().min(1).max(50),
        url: z.string().url(),
      })
    )
    .optional(),
  foundedYear: z.number().int().min(1800).max(2100).optional(),
});

export const UpdateOrganiserSchema = CreateOrganiserSchema.partial();
