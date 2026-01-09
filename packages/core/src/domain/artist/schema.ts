import { z } from 'zod';

// Input schemas for API operations
export const CreateArtistSchema = z.object({
  name: z.string().min(1).max(200),
});

export const UpdateArtistSchema = z.object({
  name: z.string().min(1).max(200).optional(),
});
