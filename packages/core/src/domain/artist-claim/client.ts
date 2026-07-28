/**
 * Client-safe exports for the ArtistClaim domain.
 * No Node.js or AWS dependencies — safe for browser import.
 *
 * `index.ts` pulls in `entity.ts`, and through it ElectroDB and the AWS SDK, which
 * crash the browser bundle. Web routes import from here instead.
 */

export type { ArtistClaim } from './entity';
export {
  ARTIST_CLAIM_KINDS,
  ARTIST_CLAIM_STATUSES,
  CreateArtistClaimInviteSchema,
  CreateArtistClaimSchema,
  normalizeArtistClaimEmail,
} from './schema';
export type { ArtistClaimKind, ArtistClaimStatus } from './schema';
