import { beforeEach, describe, expect, it, vi } from 'vitest';

const go = vi.fn().mockResolvedValue({});
const set = vi.fn(() => ({ go }));
const remove = vi.fn(() => ({ go }));

vi.mock('./entity', () => ({
  UserEntity: { update: vi.fn(() => ({ set, remove })) },
}));

describe('home location writers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('writes a resolved PIN and nothing for a refused one', async () => {
    const { setHomeLocation } = await import('.');
    expect((await setHomeLocation('u1', { pin: '560003' })).ok).toBe(true);
    expect(set).toHaveBeenCalledWith({
      homeLocation: expect.objectContaining({ pin: '560003', source: 'pin' }),
    });

    set.mockClear();
    expect(await setHomeLocation('u1', { pin: '411001' })).toEqual({
      ok: false,
      reason: 'unknown-pin',
    });
    expect(set).not.toHaveBeenCalled();
  });

  it('clears with remove(), never set(undefined)', async () => {
    const { clearHomeLocation } = await import('.');
    await clearHomeLocation('u1');
    expect(remove).toHaveBeenCalledWith(['homeLocation']);
    expect(set).not.toHaveBeenCalled();
  });
});
