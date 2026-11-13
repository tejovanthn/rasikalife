import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./entity', () => ({
  PartnerInviteEntity: {
    put: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
    query: { primary: vi.fn(), byTarget: vi.fn() },
  },
}));
vi.mock('../organiser/entity', () => ({ OrganiserEntity: { get: vi.fn(), patch: vi.fn() } }));
vi.mock('../venue/entity', () => ({ VenueEntity: { get: vi.fn(), patch: vi.fn() } }));
vi.mock('../partner-member', () => ({ addPartnerMember: vi.fn() }));

import { inviteViewer, listPendingInvitesForTarget, withdrawPartnerInvite } from '.';
import { ErrorCode } from '../../constants';
import { OrganiserEntity } from '../organiser/entity';
import { PartnerInviteEntity } from './entity';

const NOW = new Date('2026-11-12T10:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

const invite = (overrides: Record<string, unknown> = {}) => ({
  email: 'sec@sabha.org',
  targetType: 'organiser' as const,
  targetId: 'org1',
  role: 'viewer' as const,
  invitedBy: 'o1',
  createdAt: '2026-11-10T00:00:00.000Z',
  expiresAt: new Date(NOW.getTime() + 5 * DAY).toISOString(),
  ...overrides,
});

function targetInvitesAre(rows: unknown[]) {
  vi.mocked(PartnerInviteEntity.query.byTarget).mockReturnValue({
    go: vi.fn().mockResolvedValue({ data: rows }),
  } as never);
}

function inviteIs(row: unknown) {
  vi.mocked(PartnerInviteEntity.get).mockReturnValue({
    go: vi.fn().mockResolvedValue({ data: row }),
  } as never);
}

function organiserIs(row: unknown) {
  vi.mocked(OrganiserEntity.get).mockReturnValue({
    go: vi.fn().mockResolvedValue({ data: row }),
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  organiserIs({ id: 'org1', name: 'Sabha' });
  vi.mocked(PartnerInviteEntity.put).mockReturnValue({
    go: vi.fn().mockResolvedValue({ data: {} }),
  } as never);
  vi.mocked(PartnerInviteEntity.delete).mockReturnValue({
    go: vi.fn().mockResolvedValue({}),
  } as never);
});

describe('listPendingInvitesForTarget', () => {
  it('keeps unaccepted, unexpired invites, soonest expiry first', async () => {
    targetInvitesAre([
      invite({ email: 'late@x.org', expiresAt: new Date(NOW.getTime() + 9 * DAY).toISOString() }),
      invite({ email: 'soon@x.org', expiresAt: new Date(NOW.getTime() + 2 * DAY).toISOString() }),
      invite({ email: 'old@x.org', expiresAt: new Date(NOW.getTime() - DAY).toISOString() }),
      invite({ email: 'done@x.org', acceptedAt: '2026-11-11T00:00:00.000Z' }),
    ]);
    const rows = await listPendingInvitesForTarget('organiser', 'org1', NOW);
    expect(rows.map(r => r.email)).toEqual(['soon@x.org', 'late@x.org']);
    expect(PartnerInviteEntity.query.byTarget).toHaveBeenCalledWith({
      targetType: 'organiser',
      targetId: 'org1',
    });
  });
});

describe('inviteViewer', () => {
  it('always writes a viewer invite, whatever else is asked', async () => {
    targetInvitesAre([]);
    await inviteViewer(
      {
        targetType: 'organiser',
        targetId: 'org1',
        email: 'a@x.org',
        invitedBy: 'u9',
        role: 'owner',
      } as never,
      NOW
    );
    expect(PartnerInviteEntity.put).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'viewer', email: 'a@x.org', invitedBy: 'u9' })
    );
  });

  it('does not overwrite a pending owner invite for the same email', async () => {
    targetInvitesAre([invite({ email: 'a@x.org', role: 'owner' })]);
    await expect(
      inviteViewer(
        { targetType: 'organiser', targetId: 'org1', email: ' A@X.org', invitedBy: 'u9' },
        NOW
      )
    ).rejects.toMatchObject({ code: ErrorCode.PARTNER_FORBIDDEN });
    expect(PartnerInviteEntity.put).not.toHaveBeenCalled();
  });

  it('refuses a target that does not exist', async () => {
    targetInvitesAre([]);
    organiserIs(undefined);
    await expect(
      inviteViewer(
        { targetType: 'organiser', targetId: 'x', email: 'a@x.org', invitedBy: 'u' },
        NOW
      )
    ).rejects.toMatchObject({ code: ErrorCode.ORGANISER_NOT_FOUND });
  });
});

describe('withdrawPartnerInvite', () => {
  it('deletes an unaccepted viewer invite', async () => {
    inviteIs(invite());
    await withdrawPartnerInvite('Sec@Sabha.org', 'organiser', 'org1');
    expect(PartnerInviteEntity.delete).toHaveBeenCalledWith({
      email: 'sec@sabha.org',
      targetType: 'organiser',
      targetId: 'org1',
    });
  });

  it('does not find an accepted invite, or one on another target', async () => {
    inviteIs(invite({ acceptedAt: '2026-11-11T00:00:00.000Z' }));
    await expect(withdrawPartnerInvite('sec@sabha.org', 'organiser', 'org1')).rejects.toMatchObject(
      { code: ErrorCode.PARTNER_INVITE_NOT_FOUND }
    );
    inviteIs(null);
    await expect(
      withdrawPartnerInvite('sec@sabha.org', 'organiser', 'other')
    ).rejects.toMatchObject({ code: ErrorCode.PARTNER_INVITE_NOT_FOUND });
    expect(PartnerInviteEntity.delete).not.toHaveBeenCalled();
  });

  it('leaves an owner invite to a moderator', async () => {
    inviteIs(invite({ role: 'owner' }));
    await expect(withdrawPartnerInvite('sec@sabha.org', 'organiser', 'org1')).rejects.toMatchObject(
      { code: ErrorCode.PARTNER_FORBIDDEN }
    );
    expect(PartnerInviteEntity.delete).not.toHaveBeenCalled();
  });
});
