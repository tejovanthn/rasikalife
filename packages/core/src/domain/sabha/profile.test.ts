import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../db/client', () => ({ TABLE_NAME: 'T', dynamoClient: { send: vi.fn() } }));
vi.mock('./dashboard', () => ({ getPartnerTarget: vi.fn() }));
vi.mock('../organiser', () => ({ updateOrganiser: vi.fn().mockResolvedValue({}) }));
vi.mock('../venue', () => ({ updateVenue: vi.fn().mockResolvedValue({}) }));
vi.mock('../change-history/service', async importOriginal => {
  const actual = await importOriginal<typeof import('../change-history/service')>();
  return { ...actual, createChangeHistory: vi.fn().mockResolvedValue({}) };
});
vi.mock('../organiser/entity', () => ({
  OrganiserEntity: { patch: vi.fn() },
}));

import { ErrorCode } from '../../constants';
import { createChangeHistory } from '../change-history/service';
import { updateOrganiser } from '../organiser';
import { OrganiserEntity } from '../organiser/entity';
import { updateVenue } from '../venue';
import { getPartnerTarget } from './dashboard';
import {
  PartnerOrganiserProfileSchema,
  PartnerVenueProfileSchema,
  setOrganiserEventReview,
  updatePartnerProfile,
} from './profile';

const verified = { id: 'o1', name: 'Sabha', verifiedAt: '2026-11-01T00:00:00.000Z', phone: '111' };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getPartnerTarget).mockResolvedValue(verified as never);
});

describe('partner profile URL fields', () => {
  it('refuse non-http URLs', () => {
    for (const bad of ['javascript:alert(1)', 'data:text/html,x']) {
      expect(PartnerOrganiserProfileSchema.safeParse({ website: bad }).success).toBe(false);
      expect(PartnerOrganiserProfileSchema.safeParse({ logoUrl: bad }).success).toBe(false);
      expect(PartnerVenueProfileSchema.safeParse({ website: bad }).success).toBe(false);
      expect(PartnerVenueProfileSchema.safeParse({ photoUrl: bad }).success).toBe(false);
      expect(PartnerVenueProfileSchema.safeParse({ mapLink: bad }).success).toBe(false);
    }
    expect(PartnerVenueProfileSchema.safeParse({ website: 'https://a.org' }).success).toBe(true);
  });
});

describe('updatePartnerProfile', () => {
  it('refuses an unverified target', async () => {
    vi.mocked(getPartnerTarget).mockResolvedValue({ id: 'o1', name: 'Sabha' } as never);
    await expect(
      updatePartnerProfile({
        targetType: 'organiser',
        targetId: 'o1',
        userId: 'u1',
        changes: { phone: '222' },
      })
    ).rejects.toMatchObject({ code: ErrorCode.PARTNER_FORBIDDEN });
    expect(updateOrganiser).not.toHaveBeenCalled();
  });

  it('writes only the changed fields and one ChangeHistory row with the diff', async () => {
    const result = await updatePartnerProfile({
      targetType: 'organiser',
      targetId: 'o1',
      userId: 'u1',
      changes: { phone: '222', city: 'Bengaluru' },
    });

    expect(result.changed.sort()).toEqual(['city', 'phone']);
    expect(updateOrganiser).toHaveBeenCalledWith('o1', { phone: '222', city: 'Bengaluru' });
    expect(createChangeHistory).toHaveBeenCalledTimes(1);
    const entry = vi.mocked(createChangeHistory).mock.calls[0]?.[0];
    expect(entry).toMatchObject({ entityType: 'organiser', entityId: 'o1', userId: 'u1' });
    expect(entry?.diff).toEqual(
      expect.arrayContaining([{ field: 'phone', oldValue: '111', newValue: '222' }])
    );
  });

  it('writes nothing and logs nothing when nothing changed', async () => {
    const result = await updatePartnerProfile({
      targetType: 'organiser',
      targetId: 'o1',
      userId: 'u1',
      changes: { phone: '111' },
    });
    expect(result.changed).toEqual([]);
    expect(updateOrganiser).not.toHaveBeenCalled();
    expect(createChangeHistory).not.toHaveBeenCalled();
  });

  it('refuses the organiser fields that would redirect its dashboard to another venue', async () => {
    await expect(
      updatePartnerProfile({
        targetType: 'organiser',
        targetId: 'o1',
        userId: 'u1',
        changes: { venueId: 'someone-elses-hall' },
      })
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_ERROR });
    expect(updateOrganiser).not.toHaveBeenCalled();
  });

  it('refuses fields that are not profile fields at all (verifiedAt, followerCount)', async () => {
    await expect(
      updatePartnerProfile({
        targetType: 'organiser',
        targetId: 'o1',
        userId: 'u1',
        changes: { verifiedAt: '2020-01-01', followerCount: 9999 },
      })
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_ERROR });
  });

  it('updates a venue and audits it as a venue', async () => {
    vi.mocked(getPartnerTarget).mockResolvedValue({
      id: 'v1',
      name: 'Hall',
      verifiedAt: '2026-11-01T00:00:00.000Z',
    } as never);
    await updatePartnerProfile({
      targetType: 'venue',
      targetId: 'v1',
      userId: 'u1',
      changes: { capacity: 300 },
    });
    expect(updateVenue).toHaveBeenCalledWith('v1', { capacity: 300 });
    expect(vi.mocked(createChangeHistory).mock.calls[0]?.[0]).toMatchObject({
      entityType: 'venue',
      entityId: 'v1',
    });
  });
});

describe('setOrganiserEventReview', () => {
  it('stores the switch on the organiser', async () => {
    const patch = { set: vi.fn().mockReturnThis(), go: vi.fn().mockResolvedValue({}) };
    vi.mocked(OrganiserEntity.patch).mockReturnValue(patch as never);
    await expect(setOrganiserEventReview('o1', true)).resolves.toEqual({
      requireEventReview: true,
    });
    expect(patch.set).toHaveBeenCalledWith({ requireEventReview: true });
  });
});
