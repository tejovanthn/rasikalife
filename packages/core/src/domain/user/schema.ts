import { z } from 'zod';

export const CreateUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().min(1).max(100),
  picture: z.string().url().optional(),
  googleId: z.string(),
});

export const UpdateUserSchema = CreateUserSchema.partial().extend({
  lastSignedInAt: z.string().optional(),
});

export const UserPreferencesSchema = z
  .object({
    // Add preferences as needed
  })
  .optional();
