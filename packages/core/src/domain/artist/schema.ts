import { z } from 'zod';

import { YearSchema } from '../shared/schemas';
import { SocialLinkSchema } from '../social-link';

// 'invited' is a moderator pre-authorization (artist-claim/entity.ts, §4.3.1) — it is
// a valid status for an ArtistClaim row but never a value of artist.claimStatus below:
// an invite is not itself a claim, so it never flips the public badge. It shares this
// union rather than a parallel one so the vocabulary can't drift between the two places
// it's used.
export const ARTIST_CLAIM_STATUSES = [
  'unclaimed',
  'pending',
  'verified',
  'rejected',
  'invited',
] as const;
export type ArtistClaimStatus = (typeof ARTIST_CLAIM_STATUSES)[number];

export const GuruSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(200),
  fromYear: YearSchema.optional(),
  toYear: YearSchema.optional(),
  discipline: z.string().max(100).optional(),
});

export type Guru = z.infer<typeof GuruSchema>;

export const CreateArtistSchema = z.object({
  name: z.string().min(1).max(200),
  title: z.string().max(50).optional(),
  gurus: z.array(GuruSchema).default([]),
  biography: z.string().max(10000).optional(),
  specialisations: z.array(z.string().min(1).max(100)).optional(),
  birthYear: YearSchema.optional(),
  birthPlace: z.string().max(200).optional(),
  website: z.string().url().optional(),
  socialLinks: z.array(SocialLinkSchema).optional(),
  activeYears: z.string().max(50).optional(),
  // A comma-separated list: "mridangam, vocal". One free-text field rather than an array or
  // an enum, because the values arrive from posters and scrapes where a closed set would
  // reject real data (§11.1). 200 leaves room for several without inviting an essay.
  instrument: z.string().max(200).optional(),
  city: z.string().max(200).optional(),
  practiceStartYear: YearSchema.optional(),
  debutYear: YearSchema.optional(),
  photoUrl: z.string().url().optional(),
  photoUploadId: z.string().optional(),
  isGroup: z.boolean().optional(),
});

// claimStatus and verifiedAt are deliberately absent. They are set by the
// artist-claim flow, so exposing them here would let any editor — or any
// bulk CSV import — hand themselves a verified badge.
export const UpdateArtistSchema = CreateArtistSchema.partial();

/**
 * What a verified claimant may change on their own profile without a moderator (§4.3.1):
 * descriptive facts about the person, and nothing that reaches past this one record.
 *
 * The exclusions are the point, so they are listed rather than inferred:
 *
 * - `name` — a rename fires `cascadeArtistNameUpdate` across EventArtist, ArtistAward,
 *   ArtistMembership and Composition rows. Those are other people's listings.
 * - `isGroup` — `artist.update` is `moderatorProcedure` largely to hold this line (§11.1),
 *   and flipping it strands existing membership edges.
 * - `photoUrl` — the OG card lambda server-side fetches whatever URL this holds, so it is
 *   a network-request primitive, not a description. It stays with the upload flow.
 * - `alternateNames` is absent from the create schema entirely, but note for anyone adding
 *   it: it feeds the dedup matcher, so a claimant could make their record absorb the
 *   find-or-create for someone else's name.
 *
 * An edit proposing anything outside this set is not rejected — it simply goes to the
 * moderator queue like any other edit, which is where those changes belonged all along.
 */
export const CLAIMANT_EDITABLE_ARTIST_FIELDS = [
  'title',
  'gurus',
  'biography',
  'specialisations',
  'birthYear',
  'birthPlace',
  'website',
  'socialLinks',
  'activeYears',
  'instrument',
  'city',
  'practiceStartYear',
  'debutYear',
] as const;

/** True when every proposed key is one a verified claimant may self-approve. */
export function isClaimantEditablePatch(proposedValues: Record<string, unknown>): boolean {
  const allowed = new Set<string>(CLAIMANT_EDITABLE_ARTIST_FIELDS);
  return Object.keys(proposedValues).every(key => allowed.has(key));
}
