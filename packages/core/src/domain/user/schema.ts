import { z } from 'zod';
import { ROLE } from '../../auth/roles';

export const CreateUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().min(1).max(100),
  picture: z.string().url().optional(),
  googleId: z.string(),
  role: z.nativeEnum(ROLE).default(ROLE.EDITOR),
});

export const UpdateUserSchema = CreateUserSchema.partial().extend({
  lastSignedInAt: z.string().optional(),
  role: z.nativeEnum(ROLE).optional(),
});

export const UpdateUserRoleSchema = z.object({
  role: z.nativeEnum(ROLE),
});

export const UserPreferencesSchema = z
  .object({
    // Add preferences as needed
  })
  .optional();
