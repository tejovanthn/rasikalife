import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../db/client', () => ({ TABLE_NAME: 'T', dynamoClient: { send: vi.fn() } }));
vi.mock('../event', () => ({
  createEvent: vi.fn(),
  submitEvent: vi.fn(),
  approveEvent: vi.fn(),
  getEvent: vi.fn(),
  updateEvent: vi.fn(),
  updateApprovedEvent: vi.fn(),
  findLikelyDuplicatesOfEvent: vi.fn(),
}));
vi.mock('../edit/service', () => ({
  createDraft: vi.fn(),
  submitEdit: vi.fn(),
  withdrawEdit: vi.fn(),
  getActiveEditForEntity: vi.fn(),
}));
vi.mock('../event/entity', () => ({ EventEntity: { patch: vi.fn() } }));
vi.mock('../organiser', () => ({ getOrganiser: vi.fn() }));
vi.mock('../partner-member', () => ({ getPartnerMember: vi.fn() }));
vi.mock('../artist', () => ({ getArtistByName: vi.fn() }));
vi.mock('../venue', () => ({ getVenue: vi.fn() }));
vi.mock('../venue-space', () => ({ getSpace: vi.fn() }));

import { ErrorCode } from '../../constants';
import { getArtistByName } from '../artist';
import { createDraft, getActiveEditForEntity, submitEdit, withdrawEdit } from '../edit/service';
import {
  approveEvent,
  createEvent,
  findLikelyDuplicatesOfEvent,
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

const patch = {
  set: vi.fn().mockReturnThis(),
  remove: vi.fn().mockReturnThis(),
  go: vi.fn().mockResolvedValue({}),
};
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
  vi.mocked(findLikelyDuplicatesOfEvent).mockResolvedValue([]);
  vi.mocked(updateEvent).mockResolvedValue({ id: 'e1' } as never);
  vi.mocked(updateApprovedEvent).mockResolvedValue({ id: 'e1' } as never);
  vi.mocked(createDraft).mockResolvedValue({ id: 'ed1' } as never);
  vi.mocked(getActiveEditForEntity).mockResolvedValue(null);
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

  it('leaves a likely duplicate submitted for the moderator instead of publishing it', async () => {
    setup({});
    vi.mocked(findLikelyDuplicatesOfEvent).mockResolvedValue([{ id: 'e0' }] as never);
    const result = await createOwnerEvent(input, 'u1', NOW);
    expect(result).toEqual({ eventId: 'e1', published: false, heldAsDuplicate: true });
    expect(approveEvent).not.toHaveBeenCalled();
    expect(patch.set).not.toHaveBeenCalled();
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

  describe('cast and cleared fields', () => {
    const stored = {
      id: 'e1',
      organiserId: 'o1',
      status: 'approved',
      timezone: 'Asia/Kolkata',
      spaceId: 's1',
      spaceName: 'Main hall',
      venueCity: 'Chennai',
      artists: [
        { id: 'a1', name: 'Asha Rao', role: 'main', title: 'Vid.' },
        { name: 'Ravi', role: 'accompanist' },
      ],
    };

    it('leaves the cast alone when the form did not send the field', async () => {
      setup({});
      vi.mocked(getEvent).mockResolvedValue(stored as never);
      await updateOwnerEvent({ ...edit, artists: undefined }, 'u1');
      expect(vi.mocked(updateApprovedEvent).mock.calls[0]?.[1]).not.toHaveProperty('artists');
    });

    it('leaves the cast alone when the names are the stored ones', async () => {
      setup({});
      vi.mocked(getEvent).mockResolvedValue(stored as never);
      await updateOwnerEvent({ ...edit, artists: 'Asha Rao, Ravi' }, 'u1');
      expect(vi.mocked(updateApprovedEvent).mock.calls[0]?.[1]).not.toHaveProperty('artists');
    });

    it('keeps stored id, role and title, adds new names and drops only removed ones', async () => {
      setup({});
      vi.mocked(getEvent).mockResolvedValue(stored as never);
      await updateOwnerEvent({ ...edit, artists: 'Asha Rao, New Person' }, 'u1');
      expect(vi.mocked(updateApprovedEvent).mock.calls[0]?.[1]?.artists).toEqual([
        { id: 'a1', name: 'Asha Rao', role: 'main', title: 'Vid.' },
        { name: 'New Person' },
      ]);
    });

    it('removes the space when none is picked, and the city when the venue has none', async () => {
      setup({});
      vi.mocked(getEvent).mockResolvedValue(stored as never);
      vi.mocked(getVenue).mockResolvedValue({ id: 'v2', name: 'Other' } as never);
      await updateOwnerEvent({ ...edit, venueId: 'v2', spaceId: undefined }, 'u1');
      expect(patch.remove).toHaveBeenCalledWith(['spaceId', 'spaceName', 'venueCity']);
    });

    it('removes nothing when the space and city are kept', async () => {
      setup({});
      vi.mocked(getEvent).mockResolvedValue({
        ...stored,
        spaceId: undefined,
        spaceName: undefined,
      } as never);
      await updateOwnerEvent(edit, 'u1');
      expect(patch.remove).not.toHaveBeenCalled();
    });
  });

  describe('review switch on', () => {
    const live = {
      id: 'e1',
      title: 'Old',
      organiserId: 'o1',
      status: 'approved',
      timezone: 'Asia/Kolkata',
      spaceId: 's1',
      spaceName: 'Main hall',
      artists: [{ id: 'a1', name: 'Asha Rao', role: 'main' }],
    };

    it('sends an edit to an approved event to review and leaves the live event alone', async () => {
      setup({ review: true });
      vi.mocked(getEvent).mockResolvedValue(live as never);
      const result = await updateOwnerEvent({ ...edit, artists: 'Asha Rao, New Person' }, 'u1');
      expect(result).toEqual({ event: live, sentToReview: true });
      expect(updateApprovedEvent).not.toHaveBeenCalled();
      expect(updateEvent).not.toHaveBeenCalled();
      expect(patch.remove).not.toHaveBeenCalled();
      const [draft] = vi.mocked(createDraft).mock.calls[0] ?? [];
      expect(draft).toMatchObject({ entityType: 'event', entityId: 'e1', userId: 'u1' });
      expect(draft?.proposedValues.artists).toEqual([
        { id: 'a1', name: 'Asha Rao', role: 'main' },
        { name: 'New Person' },
      ]);
      expect(submitEdit).toHaveBeenCalledWith('ed1', 'u1');
    });

    it('carries a cleared space and city as clearFields', async () => {
      setup({ review: true });
      vi.mocked(getEvent).mockResolvedValue({ ...live, venueCity: 'Chennai' } as never);
      vi.mocked(getVenue).mockResolvedValue({ id: 'v2', name: 'Other' } as never);
      await updateOwnerEvent({ ...edit, venueId: 'v2', spaceId: undefined }, 'u1');
      const [draft] = vi.mocked(createDraft).mock.calls[0] ?? [];
      expect(draft?.proposedValues.clearFields).toEqual(['spaceId', 'spaceName', 'venueCity']);
    });

    it('withdraws an earlier edit of this owner that is still waiting', async () => {
      setup({ review: true });
      vi.mocked(getEvent).mockResolvedValue(live as never);
      vi.mocked(getActiveEditForEntity).mockResolvedValue({ id: 'old' } as never);
      await updateOwnerEvent(edit, 'u1');
      expect(withdrawEdit).toHaveBeenCalledWith('old', 'u1');
    });

    it('still edits a submitted event at once', async () => {
      setup({ review: true });
      vi.mocked(getEvent).mockResolvedValue({ ...live, status: 'submitted' } as never);
      const result = await updateOwnerEvent(edit, 'u1');
      expect(result.sentToReview).toBe(false);
      expect(updateEvent).toHaveBeenCalled();
      expect(createDraft).not.toHaveBeenCalled();
    });

    it('edits an approved event at once when the switch is off', async () => {
      setup({ review: false });
      vi.mocked(getEvent).mockResolvedValue(live as never);
      const result = await updateOwnerEvent(edit, 'u1');
      expect(result.sentToReview).toBe(false);
      expect(updateApprovedEvent).toHaveBeenCalled();
      expect(createDraft).not.toHaveBeenCalled();
    });
  });
});
