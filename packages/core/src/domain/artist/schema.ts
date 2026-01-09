import { z } from 'zod';

export const CreateArtistSchema = z.object({
  name: z.string().min(1).max(100),
});

export const UpdateArtistSchema = CreateArtistSchema.partial();
