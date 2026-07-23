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

/** One entry in an artist's derived collaborator list. */
export interface Collaborator {
  artistId: string;
  name: string;
  sharedEventCount: number;
  lastSharedAt: string;
  topRoles?: string[];
  strength: number;
}

/**
 * Browser-safe Artist shape. Derived from the schema rather than hand-listed,
 * so it cannot drift out of sync with what the API actually accepts — the
 * previous hand-written version had already lost `biography`, `birthYear`,
 * `socialLinks` and several more.
 *
 * The fields spelled out below are exactly the ones the schema leaves out on
 * purpose, because nothing user-facing writes them: the claim flow sets the
 * badge state, and the collaborator list is derived from shared events.
 */
export type Artist = z.infer<typeof CreateArtistSchema> & {
  id: string;
  createdAt: string;
  updatedAt: string;
  claimStatus?: ArtistClaimStatus;
  verifiedAt?: string;
  collaborators?: Collaborator[];
  collaboratorsComputedAt?: string;
};
