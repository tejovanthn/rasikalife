import { z } from 'zod';

export const CreateSocialPostSchema = z.object({
  platform: z.enum(['instagram']),
  platformPostId: z.string().min(1).max(200),
  entityType: z.enum(['artist', 'organiser', 'venue']),
  entityId: z.string().min(1),
  handle: z.string().min(1).max(100),
  postUrl: z.string().url(),
  postText: z.string().max(10000).optional(),
  mediaUrls: z.array(z.string().url()).default([]),
  postedAt: z.string().datetime({ offset: true }),
  processingStatus: z
    .enum(['pending', 'processed', 'skipped', 'failed'])
    .default('pending'),
});

export const UpdateSocialPostStatusSchema = z.object({
  processingStatus: z.enum(['pending', 'processed', 'skipped', 'failed']),
  processedAt: z.string().datetime({ offset: true }).optional(),
  extractedEventId: z.string().optional(),
  errorMessage: z.string().max(1000).optional(),
});
