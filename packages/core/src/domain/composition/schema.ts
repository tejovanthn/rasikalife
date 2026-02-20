import { z } from 'zod';

// Input schemas for API operations
export const CreateCompositionSchema = z.object({
  title: z.string().min(1).max(500),
  composer: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
  }),
  language: z.string().min(1),
  lyricsV1: z
    .array(
      z.object({
        type: z.string(),
        order: z.number(),
        text: z.string(),
        number: z.number().optional(),
        ragaName: z.string().optional(),
      })
    )
    .optional(),
  ragaIds: z.array(z.string()).optional(),
  talaIds: z.array(z.string()).optional(),
  sourceAttribution: z.string().optional(),
  compositionType: z
    .enum(['kriti', 'varnam', 'tillana', 'javali', 'padam', 'keertanam', 'other'])
    .optional(),
  description: z.string().max(5000).optional(),
  meaning: z.string().max(5000).optional(),
});

export const UpdateCompositionSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  composer: z
    .object({
      id: z.string().min(1),
      name: z.string().min(1),
    })
    .optional(),
  language: z.string().min(1).optional(),
  lyricsV1: z
    .array(
      z.object({
        type: z.string(),
        order: z.number(),
        text: z.string(),
        number: z.number().optional(),
        ragaName: z.string().optional(),
      })
    )
    .optional(),
  ragaIds: z.array(z.string()).optional(),
  talaIds: z.array(z.string()).optional(),
  compositionType: z
    .enum(['kriti', 'varnam', 'tillana', 'javali', 'padam', 'keertanam', 'other'])
    .optional(),
  description: z.string().max(5000).optional(),
  meaning: z.string().max(5000).optional(),
});
