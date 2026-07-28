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
  instrument: z.string().max(100).optional(),
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
