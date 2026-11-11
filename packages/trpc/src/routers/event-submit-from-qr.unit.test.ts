import { beforeEach, describe, expect, it, vi } from 'vitest';

const core = vi.hoisted(() => ({
  getQr: vi.fn(),
  getVenue: vi.fn(),
  getOrganiserByName: vi.fn(),
  getPartnerMember: vi.fn(),
  createEvent: vi.fn(),
  submitEvent: vi.fn(),
  approveEvent: vi.fn(),
  findLikelyDuplicatesOfEvent: vi.fn(),
}));

vi.mock('@rasika/core', async importOriginal => {
  const actual = await importOriginal<typeof import('@rasika/core')>();
  return {
    ...actual,
    VenueQr: { ...actual.VenueQr, getQr: core.getQr },
    Venue: { ...actual.Venue, getVenue: core.getVenue },
    Organiser: { ...actual.Organiser, getOrganiserByName: core.getOrganiserByName },
    PartnerMember: { ...actual.PartnerMember, getPartnerMember: core.getPartnerMember },
    Event: {
      ...actual.Event,
      createEvent: core.createEvent,
      submitEvent: core.submitEvent,
      approveEvent: core.approveEvent,
      findLikelyDuplicatesOfEvent: core.findLikelyDuplicatesOfEvent,
    },
  };
});
vi.mock('@rasika/core/site-cache', () => ({ invalidateSiteCache: vi.fn() }));
vi.mock('../reindex', () => ({ triggerReindex: vi.fn() }));

import { eventRouter } from './event';

const caller = eventRouter.createCaller({
  event: {} as never,
  user: { id: 'u1', role: 'editor' } as never,
});

const input = {
  code: 'ABCDEFGH',
  title: 'Concert',
  date: '2026-12-05',
  startTime: '18:30',
  organiserName: 'Sabha',
};

beforeEach(() => {
  for (const fn of Object.values(core)) fn.mockReset();
  core.getQr.mockResolvedValue({ status: 'active', venueId: 'v1' });
  core.getVenue.mockResolvedValue({ id: 'v1', name: 'Hall' });
  core.getOrganiserByName.mockResolvedValue({
    id: 'o1',
    name: 'Sabha',
    verifiedAt: '2026-11-01T00:00:00.000Z',
  });
  core.getPartnerMember.mockResolvedValue({ role: 'owner' });
  core.createEvent.mockResolvedValue({ id: 'e1' });
  core.submitEvent.mockResolvedValue({ id: 'e1' });
  core.approveEvent.mockResolvedValue({ id: 'e1' });
  core.findLikelyDuplicatesOfEvent.mockResolvedValue([]);
});

describe('event.submitFromQr', () => {
  it('publishes for a verified owner when there is no likely duplicate', async () => {
    expect(await caller.submitFromQr(input)).toEqual({ eventId: 'e1', published: true });
    expect(core.approveEvent).toHaveBeenCalled();
  });

  it('leaves a likely duplicate submitted for the moderator', async () => {
    core.findLikelyDuplicatesOfEvent.mockResolvedValue([{ id: 'e0' }]);
    expect(await caller.submitFromQr(input)).toEqual({ eventId: 'e1', published: false });
    expect(core.approveEvent).not.toHaveBeenCalled();
  });

  it('refuses a date that is not on the calendar', async () => {
    await expect(caller.submitFromQr({ ...input, date: '2026-02-31' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });
});
