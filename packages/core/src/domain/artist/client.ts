/**
 * Client-safe exports for Artist domain
 * No Node.js or AWS dependencies - safe for browser import
 */

import type { z } from 'zod';
import type { CreateArtistSchema, UpdateArtistSchema } from './schema';

// Re-export schemas (Zod is browser-safe)
export { CreateArtistSchema, GuruSchema, UpdateArtistSchema } from './schema';
export type { Guru } from './schema';

export const ARTIST_CLAIM_STATUSES = ['unclaimed', 'pending', 'verified', 'rejected'] as const;
export type ArtistClaimStatus = (typeof ARTIST_CLAIM_STATUSES)[number];

// Export input types derived from schemas
export type CreateArtistInput = z.infer<typeof CreateArtistSchema>;
export type UpdateArtistInput = z.infer<typeof UpdateArtistSchema>;

// Export the Artist type interface (browser-safe, no ElectroDB dependency)
export interface Artist {
  id: string;
  name: string;
  title?: string;
  gurus?: Array<{
    id?: string;
    name: string;
    fromYear?: number;
    toYear?: number;
    discipline?: string;
  }>;
  instrument?: string;
  city?: string;
  practiceStartYear?: number;
  debutYear?: number;
  photoUrl?: string;
  photoUploadId?: string;
  isGroup?: boolean;
  claimStatus?: ArtistClaimStatus;
  verifiedAt?: string;
  createdAt: string;
  updatedAt: string;
}
