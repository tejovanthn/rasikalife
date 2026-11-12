import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./entity', () => ({
  VenueSpaceEntity: {
    get: vi.fn(),
    create: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    query: { primary: vi.fn() },
  },
}));
vi.mock('../cascade', () => ({ cascadeSpaceNameUpdate: vi.fn() }));
vi.mock('../follow/target', () => ({ resolveFollowTarget: vi.fn() }));

import { createSpace, listSpaces, moveSpaces, updateSpace } from '.';
import { ErrorCode } from '../../constants';
import { cascadeSpaceNameUpdate } from '../cascade';
import { resolveFollowTarget } from '../follow/target';
import { VenueSpaceEntity } from './entity';

const go = (data: unknown) => ({ go: vi.fn().mockResolvedValue({ data }) });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(resolveFollowTarget).mockResolvedValue({ type: 'venue', id: 'v1', name: 'Hall' });
});

describe('listSpaces', () => {
  it('returns the venue spaces by name', async () => {
    vi.mocked(VenueSpaceEntity.query.primary).mockReturnValue(
      go([{ name: 'Mini hall' }, { name: 'Main hall' }]) as never
    );
    expect((await listSpaces('v1')).map(s => s.name)).toEqual(['Main hall', 'Mini hall']);
  });
});

describe('createSpace', () => {
  it('creates a space with a new id under the venue', async () => {
    vi.mocked(VenueSpaceEntity.create).mockReturnValue(go({ spaceId: 's1' }) as never);

    await createSpace({ venueId: 'v1', name: 'Main hall', capacity: 400 });

    expect(VenueSpaceEntity.create).toHaveBeenCalledWith(
      expect.objectContaining({ venueId: 'v1', name: 'Main hall', capacity: 400 })
    );
    expect(vi.mocked(VenueSpaceEntity.create).mock.calls[0][0].spaceId).toBeTruthy();
  });

  it('refuses a missing venue, and a merged one (the caller must use the canonical id)', async () => {
    vi.mocked(resolveFollowTarget).mockResolvedValueOnce(null);
    await expect(createSpace({ venueId: 'v1', name: 'X' })).rejects.toMatchObject({
      code: ErrorCode.VENUE_NOT_FOUND,
    });
    vi.mocked(resolveFollowTarget).mockResolvedValueOnce({
      type: 'venue',
      id: 'canon',
      name: 'Canon',
    });
    await expect(createSpace({ venueId: 'v1', name: 'X' })).rejects.toMatchObject({
      code: ErrorCode.VENUE_NOT_FOUND,
    });
    expect(VenueSpaceEntity.create).not.toHaveBeenCalled();
  });
});

describe('updateSpace', () => {
  it('patches only the fields given', async () => {
    vi.mocked(VenueSpaceEntity.get).mockReturnValue(go({ spaceId: 's1', name: 'Old' }) as never);
    const patch = { set: vi.fn().mockReturnThis(), go: vi.fn().mockResolvedValue({ data: {} }) };
    vi.mocked(VenueSpaceEntity.patch).mockReturnValue(patch as never);

    await updateSpace({ venueId: 'v1', spaceId: 's1', name: 'New' });

    expect(patch.set).toHaveBeenCalledWith({ name: 'New' });
  });

  describe('rename cascade', () => {
    function arrange() {
      vi.mocked(VenueSpaceEntity.get).mockReturnValue(go({ spaceId: 's1', name: 'Old' }) as never);
      const patch = { set: vi.fn().mockReturnThis(), go: vi.fn().mockResolvedValue({ data: {} }) };
      vi.mocked(VenueSpaceEntity.patch).mockReturnValue(patch as never);
    }

    it('cascades the new name on a real rename', async () => {
      arrange();
      await updateSpace({ venueId: 'v1', spaceId: 's1', name: 'New' });
      expect(cascadeSpaceNameUpdate).toHaveBeenCalledWith('v1', 's1', 'New');
    });

    it('does not cascade when the name is the stored one or not sent', async () => {
      arrange();
      await updateSpace({ venueId: 'v1', spaceId: 's1', name: 'Old', capacity: 100 });
      await updateSpace({ venueId: 'v1', spaceId: 's1', capacity: 200 });
      expect(cascadeSpaceNameUpdate).not.toHaveBeenCalled();
    });

    it('saves the rename even when the cascade throws', async () => {
      arrange();
      vi.mocked(cascadeSpaceNameUpdate).mockRejectedValue(new Error('boom'));
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      await expect(
        updateSpace({ venueId: 'v1', spaceId: 's1', name: 'New' })
      ).resolves.toBeDefined();
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  it('refuses an unknown space', async () => {
    vi.mocked(VenueSpaceEntity.get).mockReturnValue(go(undefined) as never);
    await expect(updateSpace({ venueId: 'v1', spaceId: 'nope', name: 'X' })).rejects.toMatchObject({
      code: ErrorCode.SPACE_NOT_FOUND,
    });
  });

  it('has no delete in v1', async () => {
    const mod = await import('.');
    expect(Object.keys(mod).some(k => /delete/i.test(k))).toBe(false);
  });
});

describe('moveSpaces', () => {
  it('creates each space under the canonical venue with the same id, then removes the old one', async () => {
    vi.mocked(VenueSpaceEntity.query.primary).mockReturnValue(
      go([
        { venueId: 'loser', spaceId: 's1', name: 'Main hall', createdAt: 'c1' },
        { venueId: 'loser', spaceId: 's2', name: 'Mini hall', capacity: 80, createdAt: 'c2' },
      ]) as never
    );
    const order: string[] = [];
    vi.mocked(VenueSpaceEntity.create).mockImplementation(((row: { spaceId: string }) => ({
      go: vi.fn().mockImplementation(async () => order.push(`create ${row.spaceId}`)),
    })) as never);
    vi.mocked(VenueSpaceEntity.delete).mockImplementation(((key: { spaceId: string }) => ({
      go: vi.fn().mockImplementation(async () => order.push(`delete ${key.spaceId}`)),
    })) as never);

    expect(await moveSpaces('loser', 'canon')).toBe(2);

    expect(order).toEqual(['create s1', 'delete s1', 'create s2', 'delete s2']);
    expect(VenueSpaceEntity.create).toHaveBeenCalledWith(
      expect.objectContaining({ venueId: 'canon', spaceId: 's2', capacity: 80 })
    );
  });

  it('survives a rerun that finds the copy already there', async () => {
    vi.mocked(VenueSpaceEntity.query.primary).mockReturnValue(
      go([{ venueId: 'loser', spaceId: 's1', name: 'Main hall', createdAt: 'c1' }]) as never
    );
    vi.mocked(VenueSpaceEntity.create).mockReturnValue({
      go: vi
        .fn()
        .mockRejectedValue(Object.assign(new Error('ConditionalCheckFailed'), { code: 4001 })),
    } as never);
    vi.mocked(VenueSpaceEntity.delete).mockReturnValue({
      go: vi.fn().mockResolvedValue({}),
    } as never);

    await expect(moveSpaces('loser', 'canon')).resolves.toBe(1);
    expect(VenueSpaceEntity.delete).toHaveBeenCalledWith({ venueId: 'loser', spaceId: 's1' });
  });
});
