import { z } from 'zod';

export const CreateArtistSchema = z.object({
  name: z.string().min(1).max(200),
  title: z.string().max(50).optional(),
  gurus: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string().min(1).max(200),
      })
    )
    .default([]),
});

export const UpdateArtistSchema = CreateArtistSchema.partial();
