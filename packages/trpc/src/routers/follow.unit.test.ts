import { beforeEach, describe, expect, it, vi } from 'vitest';

const follow = vi.hoisted(() => ({
  bulkSetFollows: vi.fn(),
  getFollow: vi.fn(),
  followTarget: vi.fn(),
  unfollowTarget: vi.fn(),
  getFollowStatus: vi.fn(),
  listMyFollows: vi.fn(),
  getFollowTargetCards: vi.fn(),
  setFollowShare: vi.fn(),
  purgeFollowedPages: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@rasika/core', async importOriginal => {
  const core = await importOriginal<typeof import('@rasika/core')>();
  return { ...core, Follow: { ...core.Follow, ...follow } };
});
vi.mock('@rasika/core/site-cache', () => ({ invalidateSiteCache: vi.fn() }));
const limiter = vi.hoisted(() => ({ hitRateLimit: vi.fn() }));
vi.mock('@rasika/core/shared/rate-limit', () => limiter);

import { ApplicationError, ErrorCode } from '@rasika/core/constants';
import { followRouter, toMyFollow, toTrpcError } from './follow';

const caller = followRouter.createCaller({ event: {} as never, user: { id: 'u1' } as never });
const anon = followRouter.createCaller({ event: {} as never, user: null });

beforeEach(() => {
  for (const fn of Object.values(follow)) fn.mockReset();
  follow.purgeFollowedPages.mockResolvedValue(undefined);
  limiter.hitRateLimit.mockReset();
  limiter.hitRateLimit.mockResolvedValue({ allowed: true, hits: 1 });
});

describe('follow router', () => {
  it('refuses a signed-out caller', async () => {
    await expect(anon.mine()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('toggle follows when not following, and unfollows when following', async () => {
    follow.getFollow.mockResolvedValueOnce(null);
    expect(await caller.toggle({ type: 'venue', id: 'v1' })).toEqual({ following: true });
    expect(follow.followTarget).toHaveBeenCalledWith({
      userId: 'u1',
      targetType: 'venue',
      targetId: 'v1',
    });

    follow.getFollow.mockResolvedValueOnce({ userId: 'u1' });
    expect(await caller.toggle({ type: 'venue', id: 'v1' })).toEqual({ following: false });
    expect(follow.unfollowTarget).toHaveBeenCalledWith('u1', 'venue', 'v1');
    // Each toggle purges that entity's page only, never the whole site.
    expect(follow.purgeFollowedPages).toHaveBeenCalledTimes(2);
    expect(follow.purgeFollowedPages).toHaveBeenCalledWith([{ type: 'venue', id: 'v1' }]);
  });

  it('bulkSet purges only the pages whose count moved', async () => {
    follow.bulkSetFollows.mockResolvedValue({
      newFollows: 1,
      results: [
        { type: 'venue', id: 'v1', outcome: 'followed' },
        { type: 'organiser', id: 'o1', outcome: 'already-following' },
        { type: 'artist', id: 'a1', outcome: 'unfollowed' },
        { type: 'artist', id: 'a2', outcome: 'error' },
      ],
    });
    await caller.bulkSet({ targets: [{ type: 'venue', id: 'v1', follow: true }] });
    expect(follow.purgeFollowedPages).toHaveBeenCalledWith([
      { type: 'venue', id: 'v1' },
      { type: 'artist', id: 'a1' },
    ]);
  });

  it('bulkSet passes the qr code and targets to core for the signed-in user', async () => {
    follow.bulkSetFollows.mockResolvedValue({ results: [], newFollows: 2 });
    const input = {
      qrCode: 'ABCDEFGH',
      targets: [{ type: 'venue' as const, id: 'v1', follow: true, share: true }],
    };
    await caller.bulkSet(input);
    expect(follow.bulkSetFollows).toHaveBeenCalledWith('u1', input);
  });

  it('bulkSet is limited to 30 a minute per user', async () => {
    limiter.hitRateLimit.mockResolvedValue({ allowed: false, hits: 31 });
    await expect(
      caller.bulkSet({ targets: [{ type: 'venue', id: 'v1', follow: true }] })
    ).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS' });
    expect(limiter.hitRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'follow-bulk#u1', limit: 30, windowSec: 60 })
    );
    expect(follow.bulkSetFollows).not.toHaveBeenCalled();
  });

  it('rejects an invalid qr code before reaching core', async () => {
    await expect(
      caller.bulkSet({ qrCode: 'abc', targets: [{ type: 'venue', id: 'v1', follow: true }] })
    ).rejects.toBeTruthy();
    expect(follow.bulkSetFollows).not.toHaveBeenCalled();
  });

  it('maps core errors to tRPC codes and keeps the cause', async () => {
    follow.bulkSetFollows.mockRejectedValue(
      new ApplicationError(ErrorCode.FOLLOW_SHARE_NOT_ALLOWED, 'no')
    );
    await expect(
      caller.bulkSet({ targets: [{ type: 'artist', id: 'a1', follow: true, share: true }] })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    follow.setFollowShare.mockRejectedValue(
      new ApplicationError(ErrorCode.FOLLOW_TARGET_NOT_FOUND, 'Not following')
    );
    const error = await caller.setShare({ type: 'venue', id: 'v1', share: true }).catch(e => e);
    expect(error.code).toBe('NOT_FOUND');
    expect(error.cause).toBeInstanceOf(ApplicationError);
  });

  it('status reports following and share per target key', async () => {
    follow.getFollowStatus.mockResolvedValue({
      'venue:v1': { shareWithTarget: true },
      'artist:a1': null,
    });
    expect(
      await caller.status({
        targets: [
          { type: 'venue', id: 'v1' },
          { type: 'artist', id: 'a1' },
        ],
      })
    ).toEqual({
      'venue:v1': { following: true, share: true },
      'artist:a1': { following: false, share: false },
    });
  });

  it('mine returns only the fields the page needs', async () => {
    follow.listMyFollows.mockResolvedValue([
      {
        userId: 'u1',
        targetType: 'venue',
        targetId: 'v1',
        targetName: 'Hall',
        shareWithTarget: true,
        shareConsentVersion: 'share-v1',
        createdAt: '2026-11-01T00:00:00.000Z',
      },
    ]);
    follow.getFollowTargetCards.mockResolvedValue({
      'venue:v1': { imageUrl: 'https://cdn/x.jpg', city: 'Chennai', secret: 'no' },
    });
    expect(await caller.mine()).toEqual([
      {
        targetType: 'venue',
        targetId: 'v1',
        targetName: 'Hall',
        shareWithTarget: true,
        createdAt: '2026-11-01T00:00:00.000Z',
        imageUrl: 'https://cdn/x.jpg',
        city: 'Chennai',
        instrument: null,
      },
    ]);
  });

  it('mine gives null image, city and instrument for a missing target', async () => {
    follow.listMyFollows.mockResolvedValue([
      {
        userId: 'u1',
        targetType: 'artist',
        targetId: 'a1',
        targetName: 'Gone',
        shareWithTarget: false,
        createdAt: '2026-11-01T00:00:00.000Z',
      },
    ]);
    follow.getFollowTargetCards.mockResolvedValue({});
    expect(await caller.mine()).toEqual([
      expect.objectContaining({ targetName: 'Gone', imageUrl: null, city: null, instrument: null }),
    ]);
  });
});

describe('helpers', () => {
  it('toTrpcError passes other errors through', () => {
    const plain = new Error('x');
    expect(toTrpcError(plain)).toBe(plain);
  });

  it('toMyFollow treats a missing share flag as false', () => {
    expect(
      toMyFollow({ targetType: 'artist', targetId: 'a', targetName: 'N', createdAt: 'x' } as never)
        .shareWithTarget
    ).toBe(false);
  });
});
