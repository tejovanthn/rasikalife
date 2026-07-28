import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./entity', () => ({
  ArtistClaimEntity: {
    create: vi.fn(),
    patch: vi.fn(),
    get: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    query: { primary: vi.fn(), byStatus: vi.fn(), byActor: vi.fn() },
  },
}));

vi.mock('../artist/entity', () => ({
  ArtistEntity: {
    get: vi.fn(),
    update: vi.fn(),
  },
}));

import {
  approveClaim,
  canManageArtist,
  createArtistClaim,
  createArtistClaimInvite,
  getClaimsByEmail,
  getUserClaims,
  redeemArtistClaimInvites,
  rejectClaim,
} from '.';
import { ArtistEntity } from '../artist/entity';
import { ArtistClaimEntity } from './entity';
import { normalizeArtistClaimEmail } from './schema';

function goResolves(data: unknown) {
  return { go: vi.fn().mockResolvedValue({ data }) };
}

/** `.patch().set().go()` — the shape every status transition uses. */
function mockPatch(data: unknown) {
  const setSpy = vi.fn().mockReturnValue(goResolves(data));
  vi.mocked(ArtistClaimEntity.patch).mockReturnValue({ set: setSpy } as never);
  return setSpy;
}

/** `.update().set().go()` and `.update().set().remove().go()` on the Artist row. */
function mockArtistUpdate() {
  const removeSpy = vi.fn().mockReturnValue(goResolves({}));
  const setSpy = vi.fn().mockReturnValue({ remove: removeSpy, ...goResolves({}) });
  vi.mocked(ArtistEntity.update).mockReturnValue({ set: setSpy } as never);
  return { setSpy, removeSpy };
}

function mockArtistClaims(rows: unknown[]) {
  vi.mocked(ArtistClaimEntity.query.primary).mockReturnValue(goResolves(rows) as never);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('normalizeArtistClaimEmail', () => {
  it('lowercases and trims', () => {
    expect(normalizeArtistClaimEmail('  Sanjay@Example.COM ')).toBe('sanjay@example.com');
  });

  // This address is an authorization key: an invited email that signs in is handed the
  // profile. Folding is correct for consumer Gmail and wrong for Workspace domains, and a
  // wrong fold gives one person's profile to a stranger. Locked down deliberately.
  it('does not fold gmail dots or plus suffixes', () => {
    expect(normalizeArtistClaimEmail('first.last+tag@gmail.com')).toBe('first.last+tag@gmail.com');
  });
});

describe('createArtistClaim', () => {
  const input = {
    artistId: 'artist_1',
    artistName: 'Sanjay Subrahmanyan',
    userId: 'user_1',
    userName: 'Sanjay',
    userEmail: 'sanjay@example.com',
  };

  it('writes a claim row keyed by the user, and flips an unclaimed artist to pending', async () => {
    vi.mocked(ArtistClaimEntity.create).mockReturnValue(goResolves({ id: 'c1' }) as never);
    vi.mocked(ArtistEntity.get).mockReturnValue(
      goResolves({ id: 'artist_1', claimStatus: 'unclaimed' }) as never
    );
    const { setSpy } = mockArtistUpdate();

    await createArtistClaim(input);

    expect(ArtistClaimEntity.create).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'claim', subject: 'user_1', status: 'pending' })
    );
    expect(setSpy).toHaveBeenCalledWith({ claimStatus: 'pending' });
  });

  // §4.3: "Additional claimants on an already-verified artist still create pending rows
  // requiring approval" — the badge must not regress from verified to pending.
  it('leaves the badge alone when the artist is already verified', async () => {
    vi.mocked(ArtistClaimEntity.create).mockReturnValue(goResolves({ id: 'c2' }) as never);
    vi.mocked(ArtistEntity.get).mockReturnValue(
      goResolves({ id: 'artist_1', claimStatus: 'verified' }) as never
    );
    mockArtistUpdate();

    await createArtistClaim({ ...input, userId: 'user_2' });

    expect(ArtistEntity.update).not.toHaveBeenCalled();
  });
});

describe('createArtistClaimInvite', () => {
  it('normalizes the email into both the sort key subject and the indexed attribute', async () => {
    vi.mocked(ArtistClaimEntity.create).mockReturnValue(goResolves({ id: 'i1' }) as never);

    await createArtistClaimInvite({
      artistId: 'artist_1',
      artistName: 'Sanjay Subrahmanyan',
      email: '  Sanjay@Example.COM ',
      moderatorId: 'mod_1',
    });

    expect(ArtistClaimEntity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'invite',
        subject: 'sanjay@example.com',
        email: 'sanjay@example.com',
        status: 'invited',
      })
    );
  });

  // An invite is a pre-authorization, not a claim. Flipping the badge would tell the public
  // someone has claimed the profile when nobody has even signed in yet.
  it('does not touch the artist badge', async () => {
    vi.mocked(ArtistClaimEntity.create).mockReturnValue(goResolves({ id: 'i2' }) as never);

    await createArtistClaimInvite({
      artistId: 'artist_1',
      artistName: 'X',
      email: 'a@b.com',
      moderatorId: 'mod_1',
    });

    expect(ArtistEntity.update).not.toHaveBeenCalled();
  });
});

describe('the byActor lookups', () => {
  it('separates claims from invites by kind, so one never returns the other', async () => {
    const byActor = vi.mocked(ArtistClaimEntity.query.byActor);
    byActor.mockReturnValue(goResolves([]) as never);

    await getUserClaims('user_1');
    expect(byActor).toHaveBeenCalledWith({ kind: 'claim', subject: 'user_1' });

    byActor.mockClear();
    await getClaimsByEmail('A@B.com');
    expect(byActor).toHaveBeenCalledWith({ kind: 'invite', subject: 'a@b.com' });
  });

  // getClaimsByEmail decides who is handed an artist profile at login. A query that matches
  // everything is the worst thing it could do, so a blank argument must throw rather than
  // reach DynamoDB at all.
  it('refuses a blank argument instead of querying', async () => {
    await expect(getClaimsByEmail('   ')).rejects.toThrow(/requires an email/);
    await expect(getUserClaims('')).rejects.toThrow(/requires a userId/);
    expect(ArtistClaimEntity.query.byActor).not.toHaveBeenCalled();
  });
});

describe('approveClaim', () => {
  it('verifies the row and denormalizes the badge onto the artist', async () => {
    const setSpy = mockPatch({ status: 'verified' });
    const artist = mockArtistUpdate();

    await approveClaim('artist_1', 'user_1', 'mod_1', 'Replied from the address on her site');

    expect(ArtistClaimEntity.patch).toHaveBeenCalledWith({
      artistId: 'artist_1',
      kind: 'claim',
      subject: 'user_1',
    });
    expect(setSpy).toHaveBeenCalledWith(expect.objectContaining({ status: 'verified' }));
    expect(artist.setSpy).toHaveBeenCalledWith(
      expect.objectContaining({ claimStatus: 'verified' })
    );
  });

  // §8 treats moderatorNote as the audit trail for an out-of-band identity check, and says
  // to require it on approve, not only on reject. A TS `string` still admits ''.
  it('refuses to approve without a moderator note, before writing anything', async () => {
    await expect(approveClaim('artist_1', 'user_1', 'mod_1', '  ')).rejects.toThrow(
      /moderatorNote is required/
    );
    expect(ArtistClaimEntity.patch).not.toHaveBeenCalled();
  });
});

describe('rejectClaim', () => {
  it('drops the badge to unclaimed and clears verifiedAt when nothing is left', async () => {
    mockPatch({ status: 'rejected' });
    mockArtistClaims([{ kind: 'claim', userId: 'user_1', status: 'rejected' }]);
    const artist = mockArtistUpdate();

    await rejectClaim('artist_1', 'user_1', 'mod_1', 'Could not establish identity');

    expect(artist.setSpy).toHaveBeenCalledWith({ claimStatus: 'unclaimed' });
    // Setting claimStatus alone would strand a verifiedAt from an earlier approval on a
    // profile that is no longer claimed by anyone.
    expect(artist.removeSpy).toHaveBeenCalledWith(['verifiedAt']);
  });

  // Rejecting one of several claimants must not demote the others' pending badge — that
  // would make the badge createArtistClaim set a lie.
  it('keeps the badge pending when another claimant is still pending', async () => {
    mockPatch({ status: 'rejected' });
    mockArtistClaims([
      { kind: 'claim', userId: 'user_1', status: 'rejected' },
      { kind: 'claim', userId: 'user_2', status: 'pending' },
    ]);
    const artist = mockArtistUpdate();

    await rejectClaim('artist_1', 'user_1', 'mod_1', 'Not the artist');

    expect(artist.setSpy).toHaveBeenCalledWith({ claimStatus: 'pending' });
    expect(artist.removeSpy).not.toHaveBeenCalled();
  });

  it('keeps the badge verified when another claimant is already verified', async () => {
    mockPatch({ status: 'rejected' });
    mockArtistClaims([
      { kind: 'claim', userId: 'user_1', status: 'rejected' },
      { kind: 'claim', userId: 'user_2', status: 'verified' },
    ]);
    const artist = mockArtistUpdate();

    await rejectClaim('artist_1', 'user_1', 'mod_1', 'Duplicate of the verified claim');

    expect(artist.setSpy).toHaveBeenCalledWith({ claimStatus: 'verified' });
  });

  // An outstanding invite is a pre-authorization nobody has acted on. It must not hold the
  // badge at 'pending' after the only real claim is rejected.
  it('ignores invite rows when recomputing the badge', async () => {
    mockPatch({ status: 'rejected' });
    mockArtistClaims([
      { kind: 'claim', userId: 'user_1', status: 'rejected' },
      { kind: 'invite', email: 'a@b.com', status: 'invited' },
    ]);
    const artist = mockArtistUpdate();

    await rejectClaim('artist_1', 'user_1', 'mod_1', 'Not the artist');

    expect(artist.setSpy).toHaveBeenCalledWith({ claimStatus: 'unclaimed' });
  });

  it('refuses to reject without a moderator note', async () => {
    await expect(rejectClaim('artist_1', 'user_1', 'mod_1', '')).rejects.toThrow(
      /moderatorNote is required/
    );
    expect(ArtistClaimEntity.patch).not.toHaveBeenCalled();
  });
});

describe('canManageArtist', () => {
  function mockClaimRow(data: unknown) {
    vi.mocked(ArtistClaimEntity.get).mockReturnValue(goResolves(data) as never);
  }

  it('grants access on a verified claim', async () => {
    mockClaimRow({ status: 'verified' });
    expect(await canManageArtist('user_1', 'artist_1')).toBe(true);
  });

  // A pending claim is an unproven assertion and an invite is only a moderator's intent.
  // Either one granting access would make the whole approval step decorative.
  it('refuses a pending claim, a rejected one, and no claim at all', async () => {
    mockClaimRow({ status: 'pending' });
    expect(await canManageArtist('user_1', 'artist_1')).toBe(false);
    mockClaimRow({ status: 'rejected' });
    expect(await canManageArtist('user_1', 'artist_1')).toBe(false);
    mockClaimRow(undefined);
    expect(await canManageArtist('user_1', 'artist_1')).toBe(false);
  });

  it('refuses a blank user or artist without querying', async () => {
    expect(await canManageArtist('', 'artist_1')).toBe(false);
    expect(await canManageArtist('user_1', '  ')).toBe(false);
    expect(ArtistClaimEntity.get).not.toHaveBeenCalled();
  });
});

describe('redeemArtistClaimInvites', () => {
  const user = { userId: 'user_1', userName: 'Sanjay', email: 'Sanjay@Example.COM ' };

  function mockInvites(rows: unknown[]) {
    vi.mocked(ArtistClaimEntity.query.byActor).mockReturnValue(goResolves(rows) as never);
    vi.mocked(ArtistClaimEntity.upsert).mockReturnValue(goResolves({}) as never);
    vi.mocked(ArtistClaimEntity.delete).mockReturnValue(goResolves({}) as never);
  }

  it('turns a matching invite into a verified claim and marks the artist verified', async () => {
    mockInvites([
      {
        artistId: 'artist_1',
        artistName: 'Sanjay Subrahmanyan',
        moderatorId: 'mod_1',
        moderatorNote: 'Replied from the address on her site',
      },
    ]);
    const artist = mockArtistUpdate();

    const granted = await redeemArtistClaimInvites(user);

    // Looked up by the normalized address, or an invite recorded in lower case never matches
    // the mixed-case address the provider hands back.
    expect(ArtistClaimEntity.query.byActor).toHaveBeenCalledWith({
      kind: 'invite',
      subject: 'sanjay@example.com',
    });
    expect(ArtistClaimEntity.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'claim',
        subject: 'user_1',
        status: 'verified',
        // The moderator's out-of-band identity check is the only audit trail there is, so it
        // has to survive onto the claim rather than dying with the invite.
        moderatorNote: 'Replied from the address on her site',
      })
    );
    expect(artist.setSpy).toHaveBeenCalledWith(
      expect.objectContaining({ claimStatus: 'verified' })
    );
    expect(granted).toEqual([{ artistId: 'artist_1', artistName: 'Sanjay Subrahmanyan' }]);
  });

  // Ordering matters on a partial failure: dropping the invite first could leave the artist
  // unclaimed with nothing left to retry from.
  it('writes the claim before deleting the invite', async () => {
    mockInvites([{ artistId: 'artist_1', artistName: 'X' }]);
    mockArtistUpdate();

    await redeemArtistClaimInvites(user);

    const upsertOrder = vi.mocked(ArtistClaimEntity.upsert).mock.invocationCallOrder[0];
    const deleteOrder = vi.mocked(ArtistClaimEntity.delete).mock.invocationCallOrder[0];
    expect(upsertOrder).toBeLessThan(deleteOrder);
  });

  // Runs on every login, so the overwhelmingly common case must cost one query and no writes.
  it('writes nothing when the user has no invite', async () => {
    mockInvites([]);
    mockArtistUpdate();

    expect(await redeemArtistClaimInvites(user)).toEqual([]);
    expect(ArtistClaimEntity.upsert).not.toHaveBeenCalled();
    expect(ArtistEntity.update).not.toHaveBeenCalled();
  });

  it('does nothing for a blank email rather than matching an empty partition', async () => {
    expect(await redeemArtistClaimInvites({ ...user, email: '   ' })).toEqual([]);
    expect(ArtistClaimEntity.query.byActor).not.toHaveBeenCalled();
  });
});
