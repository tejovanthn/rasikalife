import { z } from 'zod';

export const CreateOrganiserSchema = z.object({
  name: z.string().min(1).max(200),
});

export const UpdateOrganiserSchema = CreateOrganiserSchema.partial();
