import { z } from 'zod';

// Input schemas for API operations
export const CreateCompositionSchema = z.object({
  title: z.string().min(1).max(500),
  artistId: z.string().min(1),
});

export const UpdateCompositionSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  artistId: z.string().min(1).optional(),
});
