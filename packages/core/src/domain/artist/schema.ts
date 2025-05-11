import { createStringSchema, createArraySchema, locationSchema, socialLinksSchema } from '@/utils';
import { z } from 'zod';
import { ArtistType, Tradition, VerificationStatus } from './types';

// Artist creation schema - what's required when creating a new artist
export const createArtistSchema = z.object({
  name: createStringSchema({ minLength: 1, maxLength: 200 }),
  bio: createStringSchema({ maxLength: 5000 }).optional(),
  artistType: z.nativeEnum(ArtistType),
  instruments: createArraySchema(createStringSchema({ maxLength: 100 }), {
    minItems: 0,
    maxItems: 10,
  }),
  gurus: createArraySchema(createStringSchema({ maxLength: 200 }), {
    minItems: 0,
    maxItems: 20,
  }).optional(),
  lineage: createStringSchema({ maxLength: 1000 }).optional(),
  formationYear: z.number().int().min(1000).max(new Date().getFullYear()).optional(),
  location: locationSchema.optional(),
  profileImage: z.string().url().optional(),
  socialLinks: socialLinksSchema.optional(),
  website: z.string().url().optional(),
  traditions: createArraySchema(z.nativeEnum(Tradition), {
    minItems: 1,
    maxItems: 2,
  }),
  isCommunityManaged: z.boolean().default(false),
  protectionLevel: z.enum(['low', 'medium', 'high']).optional(),
});

// Update schema - partial version for updates
export const updateArtistSchema = createArtistSchema.partial();

// Full artist schema including system fields
export const artistSchema = createArtistSchema.extend({
  id: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  isVerified: z.boolean().default(false),
  verificationStatus: z.nativeEnum(VerificationStatus).default(VerificationStatus.PENDING),
  viewCount: z.number().int().default(0),
  favoriteCount: z.number().int().default(0),
  popularityScore: z.number().default(0),
  privacySettings: z
    .object({
      showContact: z.boolean().default(true),
      showEvents: z.boolean().default(true),
    })
    .optional(),
});

// Export inferred types
export type CreateArtistInput = z.infer<typeof createArtistSchema>;
export type UpdateArtistInput = z.infer<typeof updateArtistSchema>;
export type Artist = z.infer<typeof artistSchema>;
