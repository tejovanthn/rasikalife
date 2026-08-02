import { z } from 'zod';

export const CreateClassInstitutionSchema = z.object({
  name: z.string().min(1).max(200),
  ownerUserId: z.string().min(1),
  // Defaulted rather than required, because the guru is never asked. It is read from the
  // browser at sign-up and corrected in settings if it is wrong.
  timezone: z.string().min(1).max(64).default('Asia/Kolkata'),
});

export type CreateClassInstitutionInput = z.infer<typeof CreateClassInstitutionSchema>;

export const UpdateClassInstitutionSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  timezone: z.string().min(1).max(64).optional(),
});

export type UpdateClassInstitutionInput = z.infer<typeof UpdateClassInstitutionSchema>;
