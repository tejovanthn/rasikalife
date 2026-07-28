import type { z } from 'zod';
import { ArtistClaimEntity } from './entity';
import type { ArtistClaim } from './entity';
import type { CreateArtistClaimInviteSchema, CreateArtistClaimSchema } from './schema';
import { normalizeArtistClaimEmail } from './schema';

export type CreateArtistClaimInput = z.infer<typeof CreateArtistClaimSchema>;
export type CreateArtistClaimInviteInput = z.infer<typeof CreateArtistClaimInviteSchema>;

// `moderatorNote` is the audit trail for a claim decision (§8: "the moderator
// establishes identity however fits the case ... and records the reasoning in
// moderatorNote before approving. That field is the audit trail, so treat it as
// required on approve, not just on reject."). A TS-level required `string` still lets
// an empty string through, so both approveClaim and rejectClaim call this.
function assertModeratorNote(moderatorNote: string): void {
  if (!moderatorNote.trim()) {
    throw new Error(
      'moderatorNote is required to action an artist claim — it is the only audit trail proof-of-identity leaves behind'
    );
  }
}

/**
 * A signed-in user claiming an artist profile. One row per (artist, claimant) — this
 * uses `.create()` so a second claim by the same user on the same artist throws
 * rather than silently overwriting an earlier claim's status and audit trail.
 *
 * Denormalizes `artist.claimStatus` to 'pending', but only when the artist is
 * currently unclaimed (undefined or literally 'unclaimed'). A second claimant on an
 * already-pending or already-verified artist still gets their own row — the badge is
 * left alone (§4.3: "Additional claimants on an already-verified artist still create
 * pending rows requiring approval").
 */
export async function createArtistClaim(input: CreateArtistClaimInput): Promise<ArtistClaim> {
  const result = await ArtistClaimEntity.create({
    artistId: input.artistId,
    artistName: input.artistName,
    kind: 'claim',
    subject: input.userId,
    userId: input.userId,
    userName: input.userName,
    userEmail: input.userEmail,
    note: input.note,
    status: 'pending',
  }).go();

  const { ArtistEntity } = await import('../artist/entity');
  const artist = await ArtistEntity.get({ id: input.artistId }).go();
  if (artist.data && (!artist.data.claimStatus || artist.data.claimStatus === 'unclaimed')) {
    await ArtistEntity.update({ id: input.artistId }).set({ claimStatus: 'pending' }).go();
  }

  return result.data as ArtistClaim;
}

/**
 * A moderator pre-authorizing an artist's claim by email, before any user exists to
 * hold a `CLAIM#${userId}` row (§4.3.1). Uses `.create()` so re-inviting the same
 * email for the same artist throws rather than silently clobbering an earlier
 * invite's moderatorNote — a duplicate call is almost always an accidental resend.
 *
 * Does not touch `artist.claimStatus`: an invite is a pre-authorization, not a claim,
 * so it leaves the public badge alone until someone actually logs in and it converts.
 * Normalizes independently of any upstream Zod validation, so a core-direct caller
 * gets the same guarantee a router call would.
 */
export async function createArtistClaimInvite(
  input: CreateArtistClaimInviteInput
): Promise<ArtistClaim> {
  const email = normalizeArtistClaimEmail(input.email);
  const result = await ArtistClaimEntity.create({
    artistId: input.artistId,
    artistName: input.artistName,
    kind: 'invite',
    subject: email,
    email,
    status: 'invited',
    moderatorId: input.moderatorId,
    moderatorNote: input.moderatorNote,
  }).go();

  return result.data as ArtistClaim;
}

/**
 * Every claim and invite row for an artist, in one query — both kinds share the
 * ARTIST#${artistId} partition (§4.3.1) precisely so this doesn't need two.
 */
export async function getArtistClaims(artistId: string): Promise<ArtistClaim[]> {
  const result = await ArtistClaimEntity.query.primary({ artistId }).go({ pages: 'all' });
  return (result.data as ArtistClaim[]) || [];
}

/** The claim moderation queue feed, oldest first, via the byStatus GSI. */
export async function getPendingClaims(params?: {
  limit?: number;
  nextToken?: string;
}): Promise<{ items: ArtistClaim[]; nextToken?: string; hasMore: boolean }> {
  const limit = params?.limit || 20;

  const result = await ArtistClaimEntity.query
    .byStatus({ status: 'pending' })
    .go({ order: 'asc', limit, cursor: params?.nextToken });

  return {
    items: result.data || [],
    nextToken: result.cursor || undefined,
    hasMore: !!result.cursor,
  };
}

/** Every claim a user has made, across every artist, via the byActor GSI. */
export async function getUserClaims(userId: string): Promise<ArtistClaim[]> {
  if (!userId.trim()) throw new Error('getUserClaims requires a userId');
  const result = await ArtistClaimEntity.query
    .byActor({ kind: 'claim', subject: userId })
    .go({ pages: 'all' });
  return (result.data as ArtistClaim[]) || [];
}

/**
 * "Which artists is this email pre-authorized for" (§4.3.1) — the login-time authorization
 * check. Normalizes first so a mixed-case or padded address still matches what was stored,
 * and only ever returns invite rows, because `kind` is part of the partition key.
 *
 * The empty-argument guard is deliberate belt and braces. `subject` is required so the
 * partition can never be the bare prefix today, but this is the lookup that decides who
 * gets handed an artist profile, and a query that silently matches everything is the worst
 * failure it could have.
 */
export async function getClaimsByEmail(email: string): Promise<ArtistClaim[]> {
  const normalized = normalizeArtistClaimEmail(email);
  if (!normalized) throw new Error('getClaimsByEmail requires an email');
  const result = await ArtistClaimEntity.query
    .byActor({ kind: 'invite', subject: normalized })
    .go({ pages: 'all' });
  return (result.data as ArtistClaim[]) || [];
}

/**
 * Verifies a claim: the row flips to 'verified' and the artist's denormalized badge
 * follows. Always (re)writes `artist.claimStatus`/`verifiedAt` rather than reading
 * first — 'verified' only ever moves forward from here (only rejectClaim moves it
 * back), so there's nothing to lose by refreshing the timestamp on a second approval
 * for a different claimant on the same artist.
 */
export async function approveClaim(
  artistId: string,
  userId: string,
  moderatorId: string,
  moderatorNote: string
): Promise<ArtistClaim> {
  assertModeratorNote(moderatorNote);
  const now = new Date().toISOString();

  const result = await ArtistClaimEntity.patch({ artistId, kind: 'claim', subject: userId })
    .set({ status: 'verified', moderatorId, moderatorNote, processedAt: now })
    .go({ response: 'all_new' });

  const { ArtistEntity } = await import('../artist/entity');
  await ArtistEntity.update({ id: artistId })
    .set({ claimStatus: 'verified', verifiedAt: now })
    .go();

  return result.data as ArtistClaim;
}

/**
 * Rejects a claim, then recomputes `artist.claimStatus` from what is left. The plan's
 * rule is "back to unclaimed if no verified claim remains" — but a *different*
 * claimant's still-pending row must not be silently demoted to unclaimed just because
 * this claimant's row was rejected, or the "pending" badge createArtistClaim sets
 * becomes a lie the moment any one of several claimants is turned down. So the
 * recompute checks what is left in order: verified beats pending beats unclaimed.
 */
export async function rejectClaim(
  artistId: string,
  userId: string,
  moderatorId: string,
  moderatorNote: string
): Promise<ArtistClaim> {
  assertModeratorNote(moderatorNote);
  const now = new Date().toISOString();

  const result = await ArtistClaimEntity.patch({ artistId, kind: 'claim', subject: userId })
    .set({ status: 'rejected', moderatorId, moderatorNote, processedAt: now })
    .go({ response: 'all_new' });

  const remaining = await getArtistClaims(artistId);
  const otherClaims = remaining.filter(row => row.kind === 'claim' && row.userId !== userId);
  const nextStatus = otherClaims.some(row => row.status === 'verified')
    ? 'verified'
    : otherClaims.some(row => row.status === 'pending')
      ? 'pending'
      : 'unclaimed';

  const { ArtistEntity } = await import('../artist/entity');
  if (nextStatus === 'unclaimed') {
    // Remove, not set to undefined — an omitted key in `.set()` is simply dropped
    // from the update, which would leave a stale verifiedAt on an unclaimed artist.
    await ArtistEntity.update({ id: artistId })
      .set({ claimStatus: 'unclaimed' })
      .remove(['verifiedAt'])
      .go();
  } else {
    await ArtistEntity.update({ id: artistId }).set({ claimStatus: nextStatus }).go();
  }

  return result.data as ArtistClaim;
}

export type { ArtistClaim } from './entity';
export {
  ARTIST_CLAIM_KINDS,
  ARTIST_CLAIM_STATUSES,
  CreateArtistClaimInviteSchema,
  CreateArtistClaimSchema,
  normalizeArtistClaimEmail,
} from './schema';
export type { ArtistClaimKind, ArtistClaimStatus } from './schema';
