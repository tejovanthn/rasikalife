import { z } from 'zod';

// Input schemas for API operations
export const CreateCompositionSchema = z.object({
  title: z.string().min(1).max(500),
  artistId: z.string().min(1),
  ragaIds: z.array(z.string()).optional(),
  talaIds: z.array(z.string()).optional(),
});

export const UpdateCompositionSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  artistId: z.string().min(1).optional(),
  ragaIds: z.array(z.string()).optional(),
  talaIds: z.array(z.string()).optional(),
});
