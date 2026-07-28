import { z } from 'zod';
import { ARTIST_CLAIM_STATUSES } from '../artist/schema';
import type { ArtistClaimStatus } from '../artist/schema';

// Shared with artist.claimStatus (see artist/schema.ts) so the vocabulary has one
// source of truth. A claim row's own status never takes the value 'unclaimed' — that
// value only ever describes the Artist row's denormalized badge — but every function
// in this domain that writes `status` passes a literal, so the unreachable member is
// harmless.
export { ARTIST_CLAIM_STATUSES };
export type { ArtistClaimStatus };

// Two row kinds share the ArtistClaim entity (see entity.ts): a real claim made by a
// signed-in user, and a moderator's pre-authorization of an email before any user
// exists to hold one. `kind` is the discriminator; `subject` (entity.ts) copies
// whichever identifier applies so a single sort-key template serves both.
export const ARTIST_CLAIM_KINDS = ['claim', 'invite'] as const;
export type ArtistClaimKind = (typeof ARTIST_CLAIM_KINDS)[number];

/**
 * The only normalization this address is allowed to receive: lowercase and trim.
 * It doubles as an authorization key — an invited email that logs in is granted the
 * profile with no further check (§4.3.1) — so folding Gmail dots or `+` suffixes,
 * which is correct for consumer Gmail and wrong for Workspace domains, would hand
 * one person's artist profile to a stranger who happens to share the folded address.
 * Every write and lookup in this domain routes through this one function rather than
 * re-deriving the rule.
 */
export function normalizeArtistClaimEmail(email: string): string {
  return email.trim().toLowerCase();
}

const NormalizedEmailSchema = z
  .string()
  .transform(normalizeArtistClaimEmail)
  .pipe(z.string().email());

export const CreateArtistClaimSchema = z.object({
  artistId: z.string().min(1),
  artistName: z.string().min(1).max(200),
  userId: z.string().min(1),
  userName: z.string().min(1).max(200),
  userEmail: z.string().email(),
  note: z.string().max(2000).optional(),
});

export const CreateArtistClaimInviteSchema = z.object({
  artistId: z.string().min(1),
  artistName: z.string().min(1).max(200),
  email: NormalizedEmailSchema,
  moderatorId: z.string().min(1),
  // Required, unlike most notes. An invite reaches 'verified' with no review at all, so it is
  // the grant most in need of a record of why the address was trusted — and it was the only
  // one that did not ask for one.
  moderatorNote: z.string().min(1).max(2000),
});
