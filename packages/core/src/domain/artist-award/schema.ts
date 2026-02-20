import { z } from 'zod';

export const AddArtistAwardSchema = z.object({
  artistId: z.string().min(1),
  artistName: z.string().min(1).max(200),
  awardId: z.string().min(1),
  awardName: z.string().min(1).max(200),
  rank: z.number().int().min(1).optional(),
  year: z.number().int().min(1900).max(2100).optional(),
  category: z.string().max(200).optional(),
  notes: z.string().max(1000).optional(),
});
