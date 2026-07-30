/**
 * Client-safe exports for Artist domain
 * No Node.js or AWS dependencies - safe for browser import
 */

import type { z } from 'zod';
// GURU_RELATIONSHIPS is imported as a value, not just re-exported, because isGuruRelationship
// below reads it — `export ... from` creates no local binding.
import { GURU_RELATIONSHIPS } from './schema';
import type {
  ArtistClaimStatus,
  CreateArtistSchema,
  GuruRelationship,
  UpdateArtistSchema,
} from './schema';

// Re-export schemas (Zod is browser-safe). The constant arrays live in the schema and are
// re-exported here rather than redeclared in a route: they drive the wizard's selects, the
// admin CSV columns and the Zod validation, and a second copy is how those three drift.
export { GURU_RELATIONSHIPS };
export {
  ARTIST_CLAIM_STATUSES,
  CLAIM_SOURCES,
  CreateArtistSchema,
  CredentialSchema,
  GuruSchema,
  UpdateArtistSchema,
  WorkSchema,
} from './schema';
export type {
  ArtistClaimStatus,
  ClaimSource,
  Credential,
  Guru,
  GuruRelationship,
  Work,
} from './schema';

/**
 * Display labels for the guru relationship types, and the order the profile groups them in.
 *
 * `primary` and `advanced` are lineage; `workshop` and `institutional` are exposure. The
 * profile splits on exactly that line, so the order here is the render order.
 */
export const GURU_RELATIONSHIP_LABELS: Record<GuruRelationship, string> = {
  primary: 'Primary guru',
  advanced: 'Advanced training',
  workshop: 'Workshops',
  institutional: 'Institutional',
};

/** The relationship types that count as discipleship, as against workshop exposure. */
export const LINEAGE_RELATIONSHIPS: GuruRelationship[] = ['primary', 'advanced'];

/**
 * Narrows a free string — a form value, a CSV cell, an extractor's output — to a known
 * relationship.
 *
 * Worth having rather than casting at each call site: a stray value passed through would
 * fail the Zod parse for the *whole artist*, so one bad relationship would discard every
 * other edit in the same submission.
 */
export function isGuruRelationship(value: string): value is GuruRelationship {
  return (GURU_RELATIONSHIPS as readonly string[]).includes(value);
}

// Export input types derived from schemas
export type CreateArtistInput = z.infer<typeof CreateArtistSchema>;
export type UpdateArtistInput = z.infer<typeof UpdateArtistSchema>;

/**
 * How many collaborators the profile shows, and the cast size above which
 * `approveEvent` skips the inline recompute. One constant so the display cap
 * and the fan-out cap cannot drift apart.
 */
export const COLLABORATOR_INLINE_CAP = 12;

// Average month length in ms (365.2425 days / 12), used only to turn a
// timestamp gap into a "months since" figure for the recency boost below.
const MS_PER_MONTH = (1000 * 60 * 60 * 24 * 365.2425) / 12;

/**
 * `strength = sharedEventCount * (1 + 1 / (1 + monthsSinceLastShared))`, so a
 * pair with many recent shared events outranks the same count from years
 * ago. `monthsSinceLastShared` is clamped to >= 0 — a `lastSharedAt` in the
 * future cannot boost past the same-month case — and, when `lastSharedAt`
 * can't be parsed, treated as unbounded, which collapses the boost to 1 (no
 * recency information beats none).
 */
export function collaboratorStrength(
  sharedEventCount: number,
  lastSharedAt: string,
  now: Date = new Date()
): number {
  const lastSharedMs = new Date(lastSharedAt).getTime();
  const monthsSinceLastShared = Number.isNaN(lastSharedMs)
    ? Number.POSITIVE_INFINITY
    : Math.max(0, (now.getTime() - lastSharedMs) / MS_PER_MONTH);
  const recencyBoost = 1 + 1 / (1 + monthsSinceLastShared);
  return sharedEventCount * recencyBoost;
}

/** One entry in an artist's derived collaborator list. */
export interface Collaborator {
  artistId: string;
  name: string;
  sharedEventCount: number;
  lastSharedAt: string;
  topRoles?: string[];
  strength: number;
}

/** One "most performed" composition on an artist's derived repertoire. */
export interface RepertoireComposition {
  id: string;
  title: string;
  count: number;
}

/** One "most performed" raga on an artist's derived repertoire. */
export interface RepertoireRaga {
  id: string;
  name: string;
  count: number;
}

/** One moderator-featured performance, denormalized onto the artist for the teaser. */
export interface FeaturedPerformance {
  eventId: string;
  eventTitle: string;
  eventStartDateTime: string;
  role?: string;
  featureRank?: number;
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
  topCompositions?: RepertoireComposition[];
  topRagas?: RepertoireRaga[];
  repertoireComputedAt?: string;
  featuredPerformances?: FeaturedPerformance[];
  deletedAt?: string;
  mergedIntoId?: string;
};
