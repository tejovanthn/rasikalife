import { beforeEach, describe, expect, it, vi } from 'vitest';

const core = vi.hoisted(() => ({
  getPartnerMember: vi.fn(),
  listPartnerTargetsForUser: vi.fn(),
  listPartnerMembers: vi.fn(),
  revokePartnerMember: vi.fn(),
  createPartnerInvite: vi.fn(),
  acceptInvitesForUser: vi.fn(),
  getPartnerTarget: vi.fn(),
  exportFollowers: vi.fn(),
  getPartnerOverview: vi.fn(),
  updatePartnerProfile: vi.fn(),
  createOwnerEvent: vi.fn(),
  updateOwnerEvent: vi.fn(),
  setOrganiserEventReview: vi.fn(),
  listOwnerPublishedEvents: vi.fn(),
  listSpaces: vi.fn(),
  createSpace: vi.fn(),
  getUser: vi.fn(),
}));
const invite = vi.hoisted(() => ({ sendPartnerInviteEmail: vi.fn() }));
const cache = vi.hoisted(() => ({ invalidateSiteCache: vi.fn() }));

vi.mock('../partner-invite-email', () => invite);
vi.mock('../reindex', () => ({ triggerReindex: vi.fn() }));
vi.mock('@rasika/core/site-cache', () => cache);
vi.mock('@rasika/core', async importOriginal => {
  const actual = await importOriginal<typeof import('@rasika/core')>();
  return {
    ...actual,
    PartnerMember: {
      ...actual.PartnerMember,
      getPartnerMember: core.getPartnerMember,
      listPartnerTargetsForUser: core.listPartnerTargetsForUser,
      listPartnerMembers: core.listPartnerMembers,
      revokePartnerMember: core.revokePartnerMember,
    },
    PartnerInvite: {
      ...actual.PartnerInvite,
      createPartnerInvite: core.createPartnerInvite,
      acceptInvitesForUser: core.acceptInvitesForUser,
    },
    Sabha: {
      ...actual.Sabha,
      getPartnerTarget: core.getPartnerTarget,
      exportFollowers: core.exportFollowers,
      getPartnerOverview: core.getPartnerOverview,
      updatePartnerProfile: core.updatePartnerProfile,
      createOwnerEvent: core.createOwnerEvent,
      updateOwnerEvent: core.updateOwnerEvent,
      setOrganiserEventReview: core.setOrganiserEventReview,
      listOwnerPublishedEvents: core.listOwnerPublishedEvents,
    },
    User: { ...actual.User, getUser: core.getUser },
    VenueSpace: {
      ...actual.VenueSpace,
      listSpaces: core.listSpaces,
      createSpace: core.createSpace,
    },
  };
});

import { changesPublicPage } from '../middleware/site-cache';
import { createTRPCRouter } from '../trpc';
import { partnerRouter } from './partner';
import { spaceRouter } from './space';

const member = (id: string, role: string) => ({
  id,
  role,
  name: `Name ${id}`,
  email: `${id}@example.com`,
});
// Mounted like the real app, so a procedure's path is `partner.x` and the cache middleware sees
// the same name it sees in production.
const app = createTRPCRouter({ partner: partnerRouter, space: spaceRouter });
const caller = (user: ReturnType<typeof member> | null) =>
  app.createCaller({ event: {} as never, user: user as never }).partner;
const spaces = (user: ReturnType<typeof member>) =>
  app.createCaller({ event: {} as never, user: user as never }).space;

const owner = member('owner1', 'editor');
const viewer = member('viewer1', 'editor');
const stranger = member('stranger', 'editor');
const moderator = member('mod1', 'moderator');
const target = { targetType: 'organiser' as const, targetId: 'o1' };

beforeEach(() => {
  for (const fn of Object.values(core)) fn.mockReset();
  invite.sendPartnerInviteEmail.mockReset().mockResolvedValue(true);
  cache.invalidateSiteCache.mockReset();
  core.getPartnerMember.mockImplementation(async (userId: string, _t: string, id: string) => {
    if (id !== 'o1' && id !== 'v1') return null;
    if (userId === 'owner1') return { role: 'owner' };
    if (userId === 'viewer1') return { role: 'viewer' };
    return null;
  });
});

describe('exportFollowers', () => {
  it('runs for an owner, passing the owner as the one who exported', async () => {
    core.exportFollowers.mockResolvedValue({ url: 'https://x', rowCount: 3, key: 'k' });
    await expect(caller(owner).exportFollowers(target)).resolves.toMatchObject({ rowCount: 3 });
    expect(core.exportFollowers).toHaveBeenCalledWith({ ...target, userId: 'owner1' });
  });

  it('refuses a viewer, a stranger and even a moderator', async () => {
    for (const user of [viewer, stranger, moderator]) {
      await expect(caller(user).exportFollowers(target)).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    }
    expect(core.exportFollowers).not.toHaveBeenCalled();
  });
});

describe('overview', () => {
  it('lets a viewer and a moderator read, and tells the page the role', async () => {
    core.getPartnerOverview.mockResolvedValue({ followers: { total: 1 } });
    await expect(caller(viewer).overview(target)).resolves.toMatchObject({ role: 'viewer' });
    await expect(caller(moderator).overview(target)).resolves.toMatchObject({
      role: 'moderator',
    });
    await expect(caller(stranger).overview(target)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('updateProfile', () => {
  it('is for an owner only: a viewer and a moderator are refused', async () => {
    core.updatePartnerProfile.mockResolvedValue({ changed: [] });
    const call = { ...target, input: { phone: '1' } };
    await caller(owner).updateProfile(call);
    expect(core.updatePartnerProfile).toHaveBeenCalledWith({
      ...target,
      userId: 'owner1',
      changes: { phone: '1' },
    });
    await expect(caller(viewer).updateProfile(call)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(caller(moderator).updateProfile(call)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});

describe('events', () => {
  const form = {
    ...target,
    title: 'Vocal',
    date: '2026-12-05',
    startTime: '18:30',
  };

  it('lets an owner add a concert for the organiser and refuses a viewer', async () => {
    core.createOwnerEvent.mockResolvedValue({ eventId: 'e1', published: true });
    await expect(caller(owner).createEvent(form)).resolves.toEqual({
      eventId: 'e1',
      published: true,
    });
    expect(core.createOwnerEvent).toHaveBeenCalledWith(
      expect.objectContaining({ organiserId: 'o1', title: 'Vocal' }),
      'owner1'
    );
    await expect(caller(viewer).createEvent(form)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('does not add concerts under a venue target', async () => {
    await expect(
      caller(owner).createEvent({ ...form, targetType: 'venue', targetId: 'v1' })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(core.createOwnerEvent).not.toHaveBeenCalled();
  });
});

describe('moderator routes', () => {
  it('invite sends the email and reports whether it went', async () => {
    core.createPartnerInvite.mockResolvedValue({
      email: 'sec@example.org',
      role: 'owner',
      expiresAt: '2026-12-01T00:00:00.000Z',
    });
    core.getPartnerTarget.mockResolvedValue({ id: 'o1', name: 'Bangalore Gayana Samaja' });
    const result = await caller(moderator).invite({
      ...target,
      email: 'sec@example.org',
      role: 'owner',
    });
    expect(result.emailSent).toBe(true);
    expect(invite.sendPartnerInviteEmail).toHaveBeenCalledWith({
      to: 'sec@example.org',
      inviterName: 'Name mod1',
      targetName: 'Bangalore Gayana Samaja',
    });

    invite.sendPartnerInviteEmail.mockResolvedValue(false);
    expect(
      (await caller(moderator).invite({ ...target, email: 'a@b.in', role: 'viewer' })).emailSent
    ).toBe(false);
  });

  it('keeps invite, revoke, members and the review switch away from owners', async () => {
    await expect(
      caller(owner).invite({ ...target, email: 'a@b.in', role: 'owner' })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(caller(owner).revoke({ ...target, userId: 'x' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(caller(owner).members(target)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      caller(owner).setEventReview({ organiserId: 'o1', require: true })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(caller(owner).ownerPublishedEvents()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(core.createPartnerInvite).not.toHaveBeenCalled();
  });

  it('revoke removes the grant', async () => {
    core.revokePartnerMember.mockResolvedValue(true);
    await expect(caller(moderator).revoke({ ...target, userId: 'viewer1' })).resolves.toEqual({
      removed: true,
    });
    expect(core.revokePartnerMember).toHaveBeenCalledWith('viewer1', 'organiser', 'o1');
  });
});

describe('acceptInvites', () => {
  it('returns what was accepted and expired, and clears the cache for an owner invite', async () => {
    core.acceptInvitesForUser.mockResolvedValue({
      accepted: [{ targetType: 'organiser', targetId: 'o1', targetName: 'Sabha', role: 'owner' }],
      expired: [
        { targetType: 'venue', targetId: 'v1', email: 'owner1@example.com', role: 'owner' },
      ],
    });
    core.getPartnerTarget.mockResolvedValue({ id: 'v1', name: 'Hall' });
    const result = await caller(owner).acceptInvites();
    expect(core.acceptInvitesForUser).toHaveBeenCalledWith({
      id: 'owner1',
      email: 'owner1@example.com',
    });
    expect(result.accepted).toEqual([
      { targetType: 'organiser', targetId: 'o1', targetName: 'Sabha', role: 'owner' },
    ]);
    expect(result.expired).toEqual([
      { targetType: 'venue', targetId: 'v1', targetName: 'Hall', email: 'owner1@example.com' },
    ]);
    expect(cache.invalidateSiteCache).toHaveBeenCalledTimes(1);
  });

  it('does not clear the cache for a viewer invite or for nothing', async () => {
    core.acceptInvitesForUser.mockResolvedValue({
      accepted: [{ targetType: 'venue', targetId: 'v1', targetName: 'Hall', role: 'viewer' }],
      expired: [],
    });
    await caller(viewer).acceptInvites();
    core.acceptInvitesForUser.mockResolvedValue({ accepted: [], expired: [] });
    await caller(viewer).acceptInvites();
    expect(cache.invalidateSiteCache).not.toHaveBeenCalled();
  });
});

describe('mine', () => {
  it('lists the caller own dashboards by name', async () => {
    core.listPartnerTargetsForUser.mockResolvedValue([
      { targetType: 'venue', targetId: 'v1', targetName: 'Zed Hall', role: 'viewer', userId: 'x' },
      { targetType: 'organiser', targetId: 'o1', targetName: 'Alpha', role: 'owner', userId: 'x' },
    ]);
    const result = await caller(owner).mine();
    expect(result.map(r => r.targetName)).toEqual(['Alpha', 'Zed Hall']);
    expect(result[0]).not.toHaveProperty('userId');
    await expect(caller(null).mine()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});

describe('space router access', () => {
  it('lets a venue owner create, a viewer only list, a stranger nothing', async () => {
    core.listSpaces.mockResolvedValue([]);
    core.createSpace.mockResolvedValue({ spaceId: 's1' });
    const create = { venueId: 'v1', name: 'Main hall' };

    await spaces(owner).create(create);
    expect(core.createSpace).toHaveBeenCalledWith(create);
    await expect(spaces(viewer).create(create)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(spaces(stranger).create(create)).rejects.toMatchObject({ code: 'FORBIDDEN' });

    await expect(spaces(viewer).list({ venueId: 'v1' })).resolves.toEqual([]);
    await expect(spaces(stranger).list({ venueId: 'v1' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(spaces(moderator).create(create)).resolves.toBeDefined();
  });

  it('does not let an owner of one venue touch another venue', async () => {
    await expect(spaces(owner).create({ venueId: 'v2', name: 'Hall' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(
      spaces(owner).update({ venueId: 'v2', spaceId: 's1', name: 'Hall' })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('page cache', () => {
  it('clears for what a public page shows, not for access changes and files', () => {
    for (const path of [
      'partner.updateProfile',
      'partner.createEvent',
      'partner.updateEvent',
      'partner.setEventReview',
    ]) {
      expect(changesPublicPage('mutation', path, true)).toBe(true);
    }
    for (const path of [
      'partner.invite',
      'partner.revoke',
      'partner.exportFollowers',
      'partner.acceptInvites',
    ]) {
      expect(changesPublicPage('mutation', path, true)).toBe(false);
    }
  });
});
