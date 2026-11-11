import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../db/client', () => ({ TABLE_NAME: 'T', dynamoClient: { send: vi.fn() } }));
vi.mock('../event', () => ({
  createEvent: vi.fn(),
  submitEvent: vi.fn(),
  approveEvent: vi.fn(),
  getEvent: vi.fn(),
  updateEvent: vi.fn(),
  updateApprovedEvent: vi.fn(),
}));
vi.mock('../event/entity', () => ({ EventEntity: { patch: vi.fn() } }));
vi.mock('../organiser', () => ({ getOrganiser: vi.fn() }));
vi.mock('../partner-member', () => ({ getPartnerMember: vi.fn() }));
vi.mock('../artist', () => ({ getArtistByName: vi.fn() }));
vi.mock('../venue', () => ({ getVenue: vi.fn() }));
vi.mock('../venue-space', () => ({ getSpace: vi.fn() }));

import { ErrorCode } from '../../constants';
import { getArtistByName } from '../artist';
import {
  approveEvent,
  createEvent,
  getEvent,
  submitEvent,
  updateApprovedEvent,
  updateEvent,
} from '../event';
import { EventEntity } from '../event/entity';
import { getOrganiser } from '../organiser';
import { getPartnerMember } from '../partner-member';
import { getVenue } from '../venue';
import { OwnerEventSchema, createOwnerEvent, updateOwnerEvent } from './events';

const input = {
  organiserId: 'o1',
  title: 'Vocal concert',
  date: '2026-12-05',
  startTime: '18:30',
  venueId: 'v1',
  artists: 'Asha Rao, New Person',
};

const patch = { set: vi.fn().mockReturnThis(), go: vi.fn().mockResolvedValue({}) };
const NOW = new Date('2026-11-20T10:00:00.000Z');

function setup(opts: {
  role?: 'owner' | 'viewer';
  verified?: boolean;
  review?: boolean;
}) {
  vi.mocked(getOrganiser).mockResolvedValue({
    id: 'o1',
    name: 'Sabha',
    ...(opts.verified === false ? {} : { verifiedAt: '2026-11-01T00:00:00.000Z' }),
    requireEventReview: opts.review,
  } as never);
  vi.mocked(getPartnerMember).mockResolvedValue({ role: opts.role ?? 'owner' } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getVenue).mockResolvedValue({ id: 'v1', name: 'Hall', city: 'Bengaluru' } as never);
  vi.mocked(getArtistByName).mockImplementation((async (name: string) =>
    name === 'Asha Rao' ? { id: 'a1', name } : null) as never);
  vi.mocked(createEvent).mockResolvedValue({ id: 'e1' } as never);
  vi.mocked(submitEvent).mockResolvedValue({ id: 'e1' } as never);
  vi.mocked(approveEvent).mockResolvedValue({ id: 'e1' } as never);
  vi.mocked(EventEntity.patch).mockReturnValue(patch as never);
});

describe('OwnerEventSchema', () => {
  it('refuses a date that is not on the calendar', () => {
    expect(OwnerEventSchema.safeParse({ ...input, date: '2026-02-31' }).success).toBe(false);
    expect(OwnerEventSchema.safeParse({ ...input, startTime: '24:30' }).success).toBe(false);
    expect(OwnerEventSchema.safeParse(input).success).toBe(true);
  });
});

describe('createOwnerEvent', () => {
  it('publishes at once for a verified owner and marks it for the spot-check feed', async () => {
    setup({});
    const result = await createOwnerEvent(input, 'u1', NOW);

    expect(result).toEqual({ eventId: 'e1', published: true });
    expect(approveEvent).toHaveBeenCalledWith('e1', 'u1');
    expect(patch.set).toHaveBeenCalledWith({ ownerPublishedAt: '2026-11-20T10:00:00.000Z' });
  });

  it('stores the event as the organiser own, in the venue, at the hall wall clock', async () => {
    setup({});
    await createOwnerEvent(input, 'u1', NOW);
    const [event, userId, options] = vi.mocked(createEvent).mock.calls[0] ?? [];
    expect(event).toMatchObject({
      title: 'Vocal concert',
      startDateTime: '2026-12-05T18:30:00+05:30',
      timezone: 'Asia/Kolkata',
      organiserId: 'o1',
      organiserName: 'Sabha',
      venueId: 'v1',
      venueName: 'Hall',
      venueCity: 'Bengaluru',
    });
    expect(userId).toBe('u1');
    expect(options).toEqual({ status: 'draft' });
  });

  it('links a billed artist that exists by name and never creates one', async () => {
    setup({});
    await createOwnerEvent(input, 'u1', NOW);
    const [event] = vi.mocked(createEvent).mock.calls[0] ?? [];
    expect(event?.artists).toEqual([{ id: 'a1', name: 'Asha Rao' }, { name: 'New Person' }]);
  });

  it('sends the event to review when a moderator has turned review on', async () => {
    setup({ review: true });
    const result = await createOwnerEvent(input, 'u1', NOW);
    expect(result).toEqual({ eventId: 'e1', published: false });
    expect(approveEvent).not.toHaveBeenCalled();
    expect(patch.set).not.toHaveBeenCalled();
  });

  it('sends the event to review for an organiser that is not verified or a viewer', async () => {
    setup({ verified: false });
    expect((await createOwnerEvent(input, 'u1', NOW)).published).toBe(false);
    setup({ role: 'viewer' });
    expect((await createOwnerEvent(input, 'u1', NOW)).published).toBe(false);
    expect(approveEvent).not.toHaveBeenCalled();
  });
});

describe('updateOwnerEvent', () => {
  const edit = { ...input, eventId: 'e1' };

  it('refuses an event that belongs to another organiser', async () => {
    setup({});
    vi.mocked(getEvent).mockResolvedValue({
      id: 'e1',
      organiserId: 'other',
      status: 'approved',
      timezone: 'Asia/Kolkata',
    } as never);
    await expect(updateOwnerEvent(edit, 'u1')).rejects.toMatchObject({
      code: ErrorCode.EVENT_NOT_FOUND,
    });
    expect(updateApprovedEvent).not.toHaveBeenCalled();
  });

  it('edits an approved event through the approved path, in the event own zone', async () => {
    setup({});
    vi.mocked(getEvent).mockResolvedValue({
      id: 'e1',
      organiserId: 'o1',
      status: 'approved',
      timezone: 'Asia/Kolkata',
    } as never);
    await updateOwnerEvent(edit, 'u1');
    expect(updateApprovedEvent).toHaveBeenCalledWith(
      'e1',
      expect.objectContaining({ startDateTime: '2026-12-05T18:30:00+05:30', venueId: 'v1' })
    );
    expect(updateEvent).not.toHaveBeenCalled();
  });

  it('edits a submitted event through the plain path', async () => {
    setup({});
    vi.mocked(getEvent).mockResolvedValue({
      id: 'e1',
      organiserId: 'o1',
      status: 'submitted',
      timezone: 'Asia/Kolkata',
    } as never);
    await updateOwnerEvent(edit, 'u1');
    expect(updateEvent).toHaveBeenCalled();
    expect(updateApprovedEvent).not.toHaveBeenCalled();
  });
});
