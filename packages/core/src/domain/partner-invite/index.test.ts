import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./entity', () => ({
  PartnerInviteEntity: {
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    query: { primary: vi.fn() },
  },
}));
vi.mock('../organiser/entity', () => ({ OrganiserEntity: { get: vi.fn(), patch: vi.fn() } }));
vi.mock('../venue/entity', () => ({ VenueEntity: { get: vi.fn(), patch: vi.fn() } }));
vi.mock('../partner-member', () => ({ addPartnerMember: vi.fn() }));

import {
  PARTNER_INVITE_TTL_DAYS,
  acceptInviteForUser,
  acceptPartnerInvite,
  createPartnerInvite,
  listInvitesForUser,
} from '.';
import { ErrorCode } from '../../constants';
import { OrganiserEntity } from '../organiser/entity';
import { addPartnerMember } from '../partner-member';
import { VenueEntity } from '../venue/entity';
import { PartnerInviteEntity } from './entity';

const NOW = new Date('2026-11-12T10:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

const invite = (overrides: Record<string, unknown> = {}) => ({
  email: 'sec@sabha.org',
  targetType: 'organiser' as const,
  targetId: 'org1',
  role: 'owner' as const,
  invitedBy: 'mod1',
  createdAt: '2026-11-10T00:00:00.000Z',
  expiresAt: new Date(NOW.getTime() + 5 * DAY).toISOString(),
  ...overrides,
});

const USER = { id: 'u1', email: 'Sec@Sabha.org' };

function patchChain(go = vi.fn().mockResolvedValue({})) {
  const c = { set: vi.fn(() => c), where: vi.fn(() => c), go };
  return c;
}

function organiserIs(row: unknown) {
  vi.mocked(OrganiserEntity.get).mockReturnValue({
    go: vi.fn().mockResolvedValue({ data: row }),
  } as never);
}

let verifyPatch: ReturnType<typeof patchChain>;
let invitePatch: ReturnType<typeof patchChain>;

beforeEach(() => {
  vi.clearAllMocks();
  organiserIs({ id: 'org1', name: 'Sabha' });
  vi.mocked(addPartnerMember).mockResolvedValue({ userId: 'u1' } as never);
  verifyPatch = patchChain();
  invitePatch = patchChain();
  vi.mocked(OrganiserEntity.patch).mockReturnValue(verifyPatch as never);
  vi.mocked(VenueEntity.patch).mockReturnValue(verifyPatch as never);
  vi.mocked(PartnerInviteEntity.patch).mockReturnValue(invitePatch as never);
});

describe('createPartnerInvite', () => {
  it('stores the email in lowercase and expires after the TTL', async () => {
    const put = { go: vi.fn().mockResolvedValue({ data: {} }) };
    vi.mocked(PartnerInviteEntity.put).mockReturnValue(put as never);

    await createPartnerInvite(
      {
        targetType: 'organiser',
        targetId: 'org1',
        email: ' Sec@Sabha.ORG ',
        role: 'owner',
        invitedBy: 'mod1',
      },
      NOW
    );

    expect(PartnerInviteEntity.put).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'sec@sabha.org',
        expiresAt: new Date(NOW.getTime() + PARTNER_INVITE_TTL_DAYS * DAY).toISOString(),
      })
    );
    expect(PARTNER_INVITE_TTL_DAYS).toBe(14);
  });

  it('refuses a target that does not exist', async () => {
    organiserIs(undefined);
    await expect(
      createPartnerInvite(
        {
          targetType: 'organiser',
          targetId: 'nope',
          email: 'a@b.com',
          role: 'viewer',
          invitedBy: 'm',
        },
        NOW
      )
    ).rejects.toMatchObject({ code: ErrorCode.ORGANISER_NOT_FOUND });
    expect(PartnerInviteEntity.put).not.toHaveBeenCalled();
  });
});

describe('acceptPartnerInvite', () => {
  it('grants the role, verifies the target for an owner, and marks the invite accepted', async () => {
    await acceptPartnerInvite(invite() as never, USER, NOW);

    expect(addPartnerMember).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        targetType: 'organiser',
        targetId: 'org1',
        targetName: 'Sabha',
        role: 'owner',
        invitedBy: 'mod1',
      })
    );
    expect(verifyPatch.set).toHaveBeenCalledWith({ verifiedAt: NOW.toISOString() });
    // Only when none is set yet.
    expect(verifyPatch.where).toHaveBeenCalled();
    expect(invitePatch.set).toHaveBeenCalledWith({ acceptedAt: NOW.toISOString() });
  });

  it('follows a merge to the canonical target, so the grant is not left on a redirect', async () => {
    vi.mocked(OrganiserEntity.get)
      .mockReturnValueOnce({
        go: vi.fn().mockResolvedValue({ data: { id: 'org1', name: 'Old', mergedIntoId: 'org2' } }),
      } as never)
      .mockReturnValueOnce({
        go: vi.fn().mockResolvedValue({ data: { id: 'org2', name: 'Canon Sabha' } }),
      } as never);
    await acceptPartnerInvite(invite() as never, USER, NOW);

    expect(addPartnerMember).toHaveBeenCalledWith(
      expect.objectContaining({ targetId: 'org2', targetName: 'Canon Sabha' })
    );
    expect(OrganiserEntity.patch).toHaveBeenCalledWith({ id: 'org2' });
  });

  it('verifies a venue through its own entity', async () => {
    vi.mocked(VenueEntity.get).mockReturnValue({
      go: vi.fn().mockResolvedValue({ data: { id: 'v1', name: 'Hall' } }),
    } as never);

    await acceptPartnerInvite(invite({ targetType: 'venue', targetId: 'v1' }) as never, USER, NOW);

    expect(VenueEntity.patch).toHaveBeenCalledWith({ id: 'v1' });
    expect(OrganiserEntity.patch).not.toHaveBeenCalled();
  });

  it('does not verify for a viewer', async () => {
    await acceptPartnerInvite(invite({ role: 'viewer' }) as never, USER, NOW);
    expect(OrganiserEntity.patch).not.toHaveBeenCalled();
    expect(addPartnerMember).toHaveBeenCalled();
  });

  it('leaves an earlier verification alone', async () => {
    organiserIs({ id: 'org1', name: 'Sabha', verifiedAt: '2026-01-01T00:00:00.000Z' });
    await acceptPartnerInvite(invite() as never, USER, NOW);
    expect(OrganiserEntity.patch).not.toHaveBeenCalled();
  });

  it('accepts when another owner verified it a moment earlier', async () => {
    verifyPatch.go.mockRejectedValue(
      Object.assign(new Error('ConditionalCheckFailed'), { code: 4001 })
    );
    await expect(acceptPartnerInvite(invite() as never, USER, NOW)).resolves.toBeDefined();
    expect(invitePatch.set).toHaveBeenCalled();
  });

  it('refuses an expired invite', async () => {
    const expired = invite({ expiresAt: new Date(NOW.getTime() - 1000).toISOString() });
    await expect(acceptPartnerInvite(expired as never, USER, NOW)).rejects.toMatchObject({
      code: ErrorCode.PARTNER_INVITE_EXPIRED,
    });
    expect(addPartnerMember).not.toHaveBeenCalled();
  });

  it('refuses a different signed-in email', async () => {
    await expect(
      acceptPartnerInvite(invite() as never, { id: 'u9', email: 'other@x.com' }, NOW)
    ).rejects.toMatchObject({ code: ErrorCode.PARTNER_INVITE_EMAIL_MISMATCH });
    expect(addPartnerMember).not.toHaveBeenCalled();
    expect(OrganiserEntity.patch).not.toHaveBeenCalled();
  });
});

function invitesAre(rows: unknown[]) {
  vi.mocked(PartnerInviteEntity.query.primary).mockReturnValue({
    go: vi.fn().mockResolvedValue({ data: rows }),
  } as never);
}

describe('listInvitesForUser', () => {
  it('lists live invites, separates expired ones, skips accepted ones, and accepts nothing', async () => {
    invitesAre([
      invite({ targetId: 'org1' }),
      invite({ targetId: 'org2', expiresAt: new Date(NOW.getTime() - DAY).toISOString() }),
      invite({ targetId: 'org3', acceptedAt: '2026-11-11T00:00:00.000Z' }),
    ]);

    const result = await listInvitesForUser(USER, NOW);

    expect(result.pending).toEqual([
      expect.objectContaining({
        targetType: 'organiser',
        targetId: 'org1',
        targetName: 'Sabha',
        role: 'owner',
        invitedBy: 'mod1',
      }),
    ]);
    expect(result.expired.map(i => i.targetId)).toEqual(['org2']);
    expect(addPartnerMember).not.toHaveBeenCalled();
    expect(PartnerInviteEntity.patch).not.toHaveBeenCalled();
    expect(OrganiserEntity.patch).not.toHaveBeenCalled();
  });

  it('looks invites up by the lowercase email', async () => {
    invitesAre([]);
    await listInvitesForUser(USER, NOW);
    expect(PartnerInviteEntity.query.primary).toHaveBeenCalledWith({ email: 'sec@sabha.org' });
  });

  it('skips an invite whose target has been deleted', async () => {
    organiserIs({ id: 'org1', name: 'Gone', deletedAt: '2026-11-01' });
    invitesAre([invite()]);
    expect(await listInvitesForUser(USER, NOW)).toEqual({ pending: [], expired: [] });
  });
});

describe('acceptInviteForUser', () => {
  it('accepts the one named invite and reports that it verified the target', async () => {
    invitesAre([invite({ targetId: 'org1' }), invite({ targetId: 'org2' })]);

    const result = await acceptInviteForUser(
      USER,
      { targetType: 'organiser', targetId: 'org1' },
      NOW
    );

    expect(result.verified).toBe(true);
    expect(addPartnerMember).toHaveBeenCalledTimes(1);
    expect(addPartnerMember).toHaveBeenCalledWith(expect.objectContaining({ targetId: 'org1' }));
  });

  it('does not report verified when the target already was, or for a viewer', async () => {
    invitesAre([invite()]);
    organiserIs({ id: 'org1', name: 'Sabha', verifiedAt: '2026-11-01T00:00:00.000Z' });
    expect(
      (await acceptInviteForUser(USER, { targetType: 'organiser', targetId: 'org1' }, NOW)).verified
    ).toBe(false);

    organiserIs({ id: 'org1', name: 'Sabha' });
    invitesAre([invite({ role: 'viewer' })]);
    expect(
      (await acceptInviteForUser(USER, { targetType: 'organiser', targetId: 'org1' }, NOW)).verified
    ).toBe(false);
  });

  it('refuses an expired invite', async () => {
    invitesAre([invite({ expiresAt: new Date(NOW.getTime() - DAY).toISOString() })]);
    await expect(
      acceptInviteForUser(USER, { targetType: 'organiser', targetId: 'org1' }, NOW)
    ).rejects.toMatchObject({ code: ErrorCode.PARTNER_INVITE_EXPIRED });
    expect(addPartnerMember).not.toHaveBeenCalled();
  });

  it('finds no invite for another target, an accepted one, or another address', async () => {
    invitesAre([invite({ acceptedAt: '2026-11-11T00:00:00.000Z' })]);
    await expect(
      acceptInviteForUser(USER, { targetType: 'organiser', targetId: 'org1' }, NOW)
    ).rejects.toMatchObject({ code: ErrorCode.PARTNER_INVITE_NOT_FOUND });
    invitesAre([invite()]);
    await expect(
      acceptInviteForUser(USER, { targetType: 'venue', targetId: 'org1' }, NOW)
    ).rejects.toMatchObject({ code: ErrorCode.PARTNER_INVITE_NOT_FOUND });
    invitesAre([]);
    await expect(
      acceptInviteForUser(
        { id: 'u2', email: 'other@x.org' },
        { targetType: 'organiser', targetId: 'org1' },
        NOW
      )
    ).rejects.toMatchObject({ code: ErrorCode.PARTNER_INVITE_NOT_FOUND });
  });
});
