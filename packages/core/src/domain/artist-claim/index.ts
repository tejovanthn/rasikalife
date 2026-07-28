import type { z } from 'zod';
import { ArtistClaimEntity } from './entity';
import type { ArtistClaim } from './entity';
import type {
  ArtistClaimStatus,
  CreateArtistClaimInviteSchema,
  CreateArtistClaimSchema,
} from './schema';
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
    await ArtistEntity.patch({ id: input.artistId }).set({ claimStatus: 'pending' }).go();
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
  // Required here, not optional. This is the one path that reaches 'verified' with no review
  // at all, so it is the path that most needs to record why the address was trusted — leaving
  // it optional guarded the reviewed grant twice and the unreviewed grant not at all.
  assertModeratorNote(input.moderatorNote ?? '');
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
 * One user's claim on one artist, as a GetItem. The profile only ever asks about the artist
 * being viewed, and a strongly-keyed read avoids the GSI's eventual consistency showing a
 * claim button again immediately after a successful claim.
 */
export async function getClaimForUser(
  artistId: string,
  userId: string
): Promise<ArtistClaim | null> {
  if (!artistId.trim() || !userId.trim()) return null;
  const result = await ArtistClaimEntity.get({ artistId, kind: 'claim', subject: userId }).go();
  return (result.data as ArtistClaim | null) ?? null;
}

/** Outstanding invites, so a moderator can see and undo what they have handed out. */
export async function getInvitedClaims(params?: {
  limit?: number;
  nextToken?: string;
}): Promise<{ items: ArtistClaim[]; nextToken?: string; hasMore: boolean }> {
  const result = await ArtistClaimEntity.query
    .byStatus({ status: 'invited' })
    .go({ order: 'asc', limit: params?.limit || 20, cursor: params?.nextToken });

  return {
    items: result.data || [],
    nextToken: result.cursor || undefined,
    hasMore: !!result.cursor,
  };
}

/**
 * Withdraws an unredeemed invite. A mistyped address is otherwise a standing offer of
 * someone else's profile to whoever owns the typo, redeemable at any future login.
 *
 * Only reaches invite rows — once redeemed the row is a verified claim, and undoing that is
 * `rejectClaim`, which also recomputes the public badge.
 */
export async function revokeArtistClaimInvite(artistId: string, email: string): Promise<void> {
  const normalized = normalizeArtistClaimEmail(email);
  if (!normalized) throw new Error('revokeArtistClaimInvite requires an email');
  await ArtistClaimEntity.delete({ artistId, kind: 'invite', subject: normalized }).go();
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

  await markArtistVerified(artistId, now);

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

  await recomputeArtistClaimStatus(artistId, { userId, status: 'rejected' });

  return result.data as ArtistClaim;
}

/**
 * Rewrites `artist.claimStatus`/`verifiedAt` from the claim rows that actually exist.
 *
 * Anything that moves claim rows around has to call this, or the badge and the rows disagree:
 * a merge that carries a verified claim onto an artist whose own badge said 'unclaimed' would
 * otherwise leave `canManageArtist` answering true on a profile showing nothing.
 *
 * Invites are ignored — a pre-authorization nobody has acted on must not hold the badge at
 * anything. Precedence is verified, then pending, then unclaimed: rejecting one of several
 * claimants must not demote the others.
 */
export async function recomputeArtistClaimStatus(
  artistId: string,
  // The row a caller has just written. A Query is eventually consistent, so re-reading right
  // after a patch can still return the old status — which would recompute the badge from the
  // very value the caller just changed. Callers pass what they know instead.
  justWritten?: { userId: string; status: ArtistClaimStatus }
): Promise<void> {
  const rows = await getArtistClaims(artistId);
  const claims = rows
    .filter(row => row.kind === 'claim')
    .map(row =>
      justWritten && row.userId === justWritten.userId
        ? { ...row, status: justWritten.status }
        : row
    );
  if (justWritten && !claims.some(row => row.userId === justWritten.userId)) {
    claims.push({ userId: justWritten.userId, status: justWritten.status } as ArtistClaim);
  }
  const nextStatus = claims.some(row => row.status === 'verified')
    ? 'verified'
    : claims.some(row => row.status === 'pending')
      ? 'pending'
      : 'unclaimed';

  const { ArtistEntity } = await import('../artist/entity');
  if (nextStatus === 'unclaimed') {
    // Remove, not set to undefined — an omitted key in `.set()` is simply dropped
    // from the update, which would leave a stale verifiedAt on an unclaimed artist.
    await ArtistEntity.patch({ id: artistId })
      .set({ claimStatus: 'unclaimed' })
      .remove(['verifiedAt'])
      .go();
    return;
  }
  await ArtistEntity.patch({ id: artistId }).set({ claimStatus: nextStatus }).go();
}

/**
 * Whether this user may manage this artist's profile — the check behind the phase-8 access
 * grant (§4.3.1). True only for a *verified* claim: an invite is a moderator's intent, and a
 * pending claim is an unproven assertion, so neither confers anything on its own.
 *
 * This deliberately says nothing about moderators. Callers combine it with their own role
 * check, because "is a moderator" is a question about the user alone and this is a question
 * about a user and one artist; folding them together here would hide the role check from
 * every reader of the call site.
 */
export async function canManageArtist(userId: string, artistId: string): Promise<boolean> {
  if (!userId.trim() || !artistId.trim()) return false;
  const result = await ArtistClaimEntity.get({
    artistId,
    kind: 'claim',
    subject: userId,
  }).go();
  return result.data?.status === 'verified';
}

/**
 * Converts any moderator invites matching this user's email into verified claims — the
 * moment §4.3.1 is built around, where an artist a moderator emailed during enrichment
 * signs in and simply has their profile.
 *
 * No pending step: the moderator already established identity out of band, which is what §8
 * says verification rests on, and their `moderatorNote` on the invite carries that reasoning
 * onto the claim as the audit trail.
 *
 * Safe to call on every login. It is keyed on an exact normalized-email match, so a user with
 * no invite costs exactly one query and writes nothing. Returns the artists granted so a
 * caller can tell the user what just happened.
 *
 * The caller must have established that the email is *verified* by the identity provider
 * before calling — this function trusts the address it is handed, and that address is the
 * only thing standing between a stranger and someone else's profile.
 */
export async function redeemArtistClaimInvites(params: {
  userId: string;
  userName: string;
  email: string;
}): Promise<Array<{ artistId: string; artistName: string }>> {
  const email = normalizeArtistClaimEmail(params.email);
  if (!email || !params.userId.trim()) return [];

  const invites = await getClaimsByEmail(email);
  if (invites.length === 0) return [];

  const now = new Date().toISOString();
  const granted: Array<{ artistId: string; artistName: string }> = [];

  const { ArtistEntity } = await import('../artist/entity');

  for (const invite of invites) {
    // An artist deleted or merged away after the invite was written must not be resurrected
    // with a verified badge. The invite is dropped rather than kept: the record it pointed at
    // is gone, so re-checking it on every future login would never succeed.
    const artist = await ArtistEntity.get({ id: invite.artistId }).go();
    if (!artist.data || artist.data.deletedAt || artist.data.mergedIntoId) {
      await ArtistClaimEntity.delete({
        artistId: invite.artistId,
        kind: 'invite',
        subject: email,
      }).go();
      continue;
    }

    // upsert, not create: a user who was invited to an artist they had already claimed
    // themselves should end up verified, not collide with their own pending row.
    await ArtistClaimEntity.upsert({
      artistId: invite.artistId,
      artistName: invite.artistName,
      kind: 'claim',
      subject: params.userId,
      userId: params.userId,
      userName: params.userName,
      userEmail: email,
      status: 'verified',
      moderatorId: invite.moderatorId,
      moderatorNote: invite.moderatorNote,
      // Carried explicitly. ElectroDB's upsert re-applies the `createdAt` default
      // unconditionally, so without this the invite's own timestamp — the only record of
      // when the address was trusted — is overwritten with the moment of redemption, and a
      // pre-existing self-serve claim loses its original date too.
      invitedAt: invite.createdAt,
      processedAt: now,
    }).go();

    await markArtistVerified(invite.artistId, now);

    // Only once the claim exists. If this throws the invite is simply redeemed again on the
    // next login and the upsert above is idempotent — the reverse order could drop the
    // invite while leaving the artist unclaimed, with nothing left to retry from.
    await ArtistClaimEntity.delete({
      artistId: invite.artistId,
      kind: 'invite',
      subject: email,
    }).go();

    granted.push({ artistId: invite.artistId, artistName: invite.artistName });
  }

  return granted;
}

// `.patch()`, never `.update()`: update carries no existence condition, so a bad or
// already-deleted artist id would create a phantom row rather than fail — the exact shape of
// the uppercase-key bug this repo had to repair in production.
async function markArtistVerified(artistId: string, now: string): Promise<void> {
  const { ArtistEntity } = await import('../artist/entity');
  await ArtistEntity.patch({ id: artistId }).set({ claimStatus: 'verified', verifiedAt: now }).go();
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
