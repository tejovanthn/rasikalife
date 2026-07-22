/**
 * Client-safe exports for Artist domain
 * No Node.js or AWS dependencies - safe for browser import
 */

import type { z } from 'zod';
import type { ArtistClaimStatus, CreateArtistSchema, UpdateArtistSchema } from './schema';

// Re-export schemas (Zod is browser-safe)
export {
  ARTIST_CLAIM_STATUSES,
  CreateArtistSchema,
  GuruSchema,
  UpdateArtistSchema,
} from './schema';
export type { ArtistClaimStatus, Guru } from './schema';

// Export input types derived from schemas
export type CreateArtistInput = z.infer<typeof CreateArtistSchema>;
export type UpdateArtistInput = z.infer<typeof UpdateArtistSchema>;

/**
 * Browser-safe Artist shape. Derived from the schema rather than hand-listed,
 * so it cannot drift out of sync with what the API actually accepts — the
 * previous hand-written version had already lost `biography`, `birthYear`,
 * `socialLinks` and several more.
 *
 * The two fields spelled out below are exactly the two the schema leaves out
 * on purpose: only the artist-claim flow writes them.
 */
export type Artist = z.infer<typeof CreateArtistSchema> & {
  id: string;
  createdAt: string;
  updatedAt: string;
  claimStatus?: ArtistClaimStatus;
  verifiedAt?: string;
};
