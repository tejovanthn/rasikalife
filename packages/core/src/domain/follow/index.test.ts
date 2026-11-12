import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../db/client', () => ({
  TABLE_NAME: 'RasikaLifeTable',
  dynamoClient: { send: vi.fn() },
}));

// Real `create` and `delete` so the transaction carries the true keys and conditions. Reads are
// served from the fake table below.
vi.mock('./entity', async importOriginal => {
  const actual = await importOriginal<typeof import('./entity')>();
  const real = actual.FollowEntity;
  return {
    FollowEntity: {
      conversions: real.conversions,
      create: (item: never) => real.create(item),
      delete: (key: never) => real.delete(key),
      get: vi.fn(),
      patch: vi.fn(),
      query: { byTarget: vi.fn(), primary: vi.fn() },
    },
  };
});
vi.mock('./target', () => ({ resolveFollowTarget: vi.fn() }));
vi.mock('../venue-qr', () => ({
  recordQrFollows: vi.fn().mockResolvedValue(undefined),
  getQr: vi.fn(),
}));

import {
  bulkSetFollows,
  deleteUserFollows,
  followTarget,
  getFollowStatus,
  getFollowTargetCards,
  moveFollows,
  setFollowShare,
  unfollowTarget,
} from '.';
import { ApplicationError, ErrorCode } from '../../constants';
import { dynamoClient } from '../../db/client';
import { keyOfEntity } from '../../db/keys';
import { ArtistEntity } from '../artist/entity';
import { OrganiserEntity } from '../organiser/entity';
import { getQr, recordQrFollows } from '../venue-qr';
import { CONSENT_VERSIONS } from '../venue-qr/constants';
import { VenueEntity } from '../venue/entity';
import { FollowEntity } from './entity';
import type { Follow } from './entity';
import { resolveFollowTarget } from './target';

/**
 * A small model of the table: follow rows, and target rows with a follower counter. The
 * TransactWrite handler enforces the conditions DynamoDB would, and cancels the whole
 * transaction (changing nothing) when any one fails. That is what makes "twice never double
 * counts" a real assertion rather than a restatement of the code.
 */
type Row = Record<string, unknown> & { pk: string; sk: string };
const follows = new Map<string, Row>();
const targets = new Map<string, { followerCount: number }>();

const rowKey = (pk: string, sk: string) => `${pk}|${sk}`;
const targetRowKey = (key: { pk: string; sk: string }) => rowKey(key.pk, key.sk);

function addTarget(type: 'venue' | 'organiser' | 'artist', id: string, followerCount = 0) {
  const entity =
    type === 'venue' ? VenueEntity : type === 'organiser' ? OrganiserEntity : ArtistEntity;
  targets.set(targetRowKey(keyOfEntity(entity, { id })), { followerCount });
}

function counter(type: 'venue' | 'organiser' | 'artist', id: string): number | undefined {
  const entity =
    type === 'venue' ? VenueEntity : type === 'organiser' ? OrganiserEntity : ArtistEntity;
  return targets.get(targetRowKey(keyOfEntity(entity, { id })))?.followerCount;
}

type Item = {
  Put?: { Item: Row; ConditionExpression?: string };
  Delete?: { Key: { pk: string; sk: string }; ConditionExpression?: string };
  Update?: {
    Key: { pk: string; sk: string };
    ConditionExpression?: string;
    ExpressionAttributeValues: { ':delta': number };
  };
};

function transactWrite(items: Item[]) {
  const reasons = items.map(item => {
    if (item.Put?.ConditionExpression?.includes('attribute_not_exists')) {
      return follows.has(rowKey(item.Put.Item.pk, item.Put.Item.sk))
        ? { Code: 'ConditionalCheckFailed' }
        : { Code: 'None' };
    }
    if (item.Delete?.ConditionExpression?.includes('attribute_exists')) {
      return follows.has(rowKey(item.Delete.Key.pk, item.Delete.Key.sk))
        ? { Code: 'None' }
        : { Code: 'ConditionalCheckFailed' };
    }
    if (item.Update?.ConditionExpression?.includes('attribute_exists')) {
      return targets.has(targetRowKey(item.Update.Key))
        ? { Code: 'None' }
        : { Code: 'ConditionalCheckFailed' };
    }
    return { Code: 'None' };
  });

  if (reasons.some(r => r.Code === 'ConditionalCheckFailed')) {
    throw Object.assign(new Error('Transaction cancelled'), {
      name: 'TransactionCanceledException',
      CancellationReasons: reasons,
    });
  }
  for (const item of items) {
    if (item.Put) follows.set(rowKey(item.Put.Item.pk, item.Put.Item.sk), item.Put.Item);
    if (item.Delete) follows.delete(rowKey(item.Delete.Key.pk, item.Delete.Key.sk));
    if (item.Update) {
      const target = targets.get(targetRowKey(item.Update.Key));
      if (target) target.followerCount += item.Update.ExpressionAttributeValues[':delta'];
    }
  }
  return {};
}

const rowFor = (userId: string, type: string, id: string) =>
  follows.get(rowKey(`user#${userId}`, `follow#${type}#${id}`));

/** The attributes a stored row exposes to the code under test. */
function asFollow(row: Row | undefined): Follow | undefined {
  return row as unknown as Follow | undefined;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getQr).mockResolvedValue({ status: 'active' } as never);
  follows.clear();
  targets.clear();

  vi.mocked(dynamoClient.send).mockImplementation((async (command: {
    constructor: { name: string };
    TransactItems?: Item[];
    Key?: { pk: string; sk: string };
    ExpressionAttributeValues?: { ':count': number };
  }) => {
    if (command.constructor.name === 'TransactWriteCommand') {
      return transactWrite(command.TransactItems as Item[]);
    }
    if (command.constructor.name === 'UpdateCommand' && command.Key) {
      const target = targets.get(targetRowKey(command.Key));
      if (target && command.ExpressionAttributeValues) {
        target.followerCount = command.ExpressionAttributeValues[':count'];
      }
      return {};
    }
    throw new Error(`Unexpected command ${command.constructor.name}`);
  }) as never);

  vi.mocked(resolveFollowTarget).mockImplementation((async (type: string, id: string) => {
    const known = counter(type as never, id);
    return known === undefined ? null : { type, id, name: `Name of ${id}` };
  }) as never);

  vi.mocked(FollowEntity.get).mockImplementation(((key: unknown) => {
    const one = (k: { userId: string; targetType: string; targetId: string }) =>
      asFollow(rowFor(k.userId, k.targetType, k.targetId));
    if (Array.isArray(key)) {
      return {
        go: vi.fn().mockResolvedValue({ data: key.map(one).filter(Boolean), unprocessed: [] }),
      };
    }
    return { go: vi.fn().mockResolvedValue({ data: one(key as never) ?? null }) };
  }) as never);

  vi.mocked(FollowEntity.query.byTarget).mockImplementation((({
    targetType,
    targetId,
  }: {
    targetType: string;
    targetId: string;
  }) => ({
    go: vi.fn().mockImplementation(async () => ({
      data: [...follows.values()].filter(
        r => r.targetType === targetType && r.targetId === targetId
      ),
      cursor: null,
    })),
  })) as never);

  vi.mocked(FollowEntity.query.primary).mockImplementation((({ userId }: { userId: string }) => ({
    go: vi.fn().mockImplementation(async () => ({
      data: [...follows.values()].filter(r => r.userId === userId),
    })),
  })) as never);
});

const FOLLOW = { userId: 'u1', targetType: 'venue' as const, targetId: 'venue1' };

describe('followTarget', () => {
  it('writes the follow and adds one to the counter', async () => {
    addTarget('venue', 'venue1');

    const result = await followTarget(FOLLOW);

    expect(result.created).toBe(true);
    expect(result.follow.targetName).toBe('Name of venue1');
    expect(counter('venue', 'venue1')).toBe(1);
  });

  it('never double counts: a second follow changes nothing', async () => {
    addTarget('venue', 'venue1');

    const first = await followTarget(FOLLOW);
    const second = await followTarget(FOLLOW);
    const third = await followTarget(FOLLOW);

    expect([first.created, second.created, third.created]).toEqual([true, false, false]);
    expect(counter('venue', 'venue1')).toBe(1);
    expect(follows.size).toBe(1);
  });

  it('counts each user once', async () => {
    addTarget('organiser', 'org1');
    await followTarget({ userId: 'u1', targetType: 'organiser', targetId: 'org1' });
    await followTarget({ userId: 'u2', targetType: 'organiser', targetId: 'org1' });
    expect(counter('organiser', 'org1')).toBe(2);
  });

  it('refuses a target that cannot be found, writing nothing', async () => {
    await expect(followTarget(FOLLOW)).rejects.toMatchObject({
      code: ErrorCode.FOLLOW_TARGET_NOT_FOUND,
    });
    expect(dynamoClient.send).not.toHaveBeenCalled();
  });

  it('rolls the follow back when the target row vanished before the counter moved', async () => {
    addTarget('venue', 'venue1');
    vi.mocked(resolveFollowTarget).mockResolvedValue({
      type: 'venue',
      id: 'venue1',
      name: 'Hall',
    });
    targets.clear();

    await expect(followTarget(FOLLOW)).rejects.toMatchObject({
      code: ErrorCode.FOLLOW_TARGET_NOT_FOUND,
    });
    expect(follows.size).toBe(0);
  });

  it('follows a merged target through to the canonical one', async () => {
    addTarget('venue', 'canon');
    vi.mocked(resolveFollowTarget).mockResolvedValue({
      type: 'venue',
      id: 'canon',
      name: 'Canon',
    });

    const { follow } = await followTarget({ ...FOLLOW, targetId: 'loser' });

    expect(follow.targetId).toBe('canon');
    expect(counter('venue', 'canon')).toBe(1);
  });

  it('records where the follow came from', async () => {
    addTarget('venue', 'venue1');
    const { follow } = await followTarget({ ...FOLLOW, qrCode: 'ABCDEFGH', eventId: 'ev1' });
    expect(follow).toMatchObject({ source: 'qr', qrCode: 'ABCDEFGH', eventId: 'ev1' });

    addTarget('organiser', 'org1');
    const web = await followTarget({ userId: 'u1', targetType: 'organiser', targetId: 'org1' });
    expect(web.follow.source).toBe('web');
  });
});

describe('sharing', () => {
  it('stores the consent time and text version when sharing is chosen', async () => {
    addTarget('organiser', 'org1');
    const now = new Date('2026-11-12T10:00:00.000Z');

    const { follow } = await followTarget(
      { userId: 'u1', targetType: 'organiser', targetId: 'org1', share: true },
      now
    );

    expect(follow.shareWithTarget).toBe(true);
    expect(follow.shareConsentAt).toBe('2026-11-12T10:00:00.000Z');
    expect(follow.shareConsentVersion).toBe(CONSENT_VERSIONS.share);
  });

  it('is never on by default', async () => {
    addTarget('organiser', 'org1');
    const { follow } = await followTarget({
      userId: 'u1',
      targetType: 'organiser',
      targetId: 'org1',
    });
    expect(follow.shareWithTarget).toBe(false);
    expect(follow.shareConsentAt).toBeUndefined();
    expect(follow.shareConsentVersion).toBeUndefined();
  });

  it('is refused for an artist', async () => {
    addTarget('artist', 'art1');
    const error = await followTarget({
      userId: 'u1',
      targetType: 'artist',
      targetId: 'art1',
      share: true,
    }).catch(e => e);
    expect(error).toBeInstanceOf(ApplicationError);
    expect(error.code).toBe(ErrorCode.FOLLOW_SHARE_NOT_ALLOWED);
    expect(follows.size).toBe(0);
  });

  it('applies a share choice to a follow that already exists, without a second count', async () => {
    addTarget('venue', 'venue1');
    await followTarget(FOLLOW);
    const patch = {
      set: vi.fn().mockReturnThis(),
      remove: vi.fn().mockReturnThis(),
      go: vi.fn().mockResolvedValue({ data: { shareWithTarget: true } }),
    };
    vi.mocked(FollowEntity.patch).mockReturnValue(patch as never);

    const result = await followTarget({ ...FOLLOW, share: true });

    expect(result.created).toBe(false);
    expect(counter('venue', 'venue1')).toBe(1);
    expect(patch.set).toHaveBeenCalledWith(
      expect.objectContaining({ shareWithTarget: true, shareConsentVersion: 'share-v1' })
    );
  });

  it('withdraws sharing, keeps the follow and records when', async () => {
    addTarget('venue', 'venue1');
    await followTarget({ ...FOLLOW, share: true });
    const patch = {
      set: vi.fn().mockReturnThis(),
      remove: vi.fn().mockReturnThis(),
      go: vi.fn().mockResolvedValue({ data: { shareWithTarget: false } }),
    };
    vi.mocked(FollowEntity.patch).mockReturnValue(patch as never);
    const now = new Date('2026-11-20T10:00:00Z');

    await setFollowShare(
      { userId: 'u1', targetType: 'venue', targetId: 'venue1', share: false },
      now
    );

    expect(patch.set).toHaveBeenCalledWith({
      shareWithTarget: false,
      shareWithdrawnAt: '2026-11-20T10:00:00.000Z',
    });
  });

  it('does not stamp a withdrawal when sharing was already off', async () => {
    addTarget('venue', 'venue1');
    await followTarget(FOLLOW);
    const patch = { set: vi.fn().mockReturnThis(), go: vi.fn() };
    vi.mocked(FollowEntity.patch).mockReturnValue(patch as never);

    await setFollowShare({ userId: 'u1', targetType: 'venue', targetId: 'venue1', share: false });

    expect(patch.set).not.toHaveBeenCalled();
  });

  it('removes shareWithdrawnAt when sharing is granted again (rule 8)', async () => {
    const patch = {
      set: vi.fn().mockReturnThis(),
      remove: vi.fn().mockReturnThis(),
      go: vi.fn().mockResolvedValue({ data: { shareWithTarget: true } }),
    };
    vi.mocked(FollowEntity.patch).mockReturnValue(patch as never);

    await setFollowShare({ userId: 'u1', targetType: 'venue', targetId: 'venue1', share: true });

    expect(patch.remove).toHaveBeenCalledWith(['shareWithdrawnAt']);
  });

  it('refuses to withdraw from a follow that does not exist', async () => {
    await expect(
      setFollowShare({ userId: 'u1', targetType: 'venue', targetId: 'nope', share: false })
    ).rejects.toMatchObject({ code: ErrorCode.FOLLOW_TARGET_NOT_FOUND });
  });

  it('refuses setShare for an artist', async () => {
    await expect(
      setFollowShare({ userId: 'u1', targetType: 'artist', targetId: 'a', share: true })
    ).rejects.toMatchObject({ code: ErrorCode.FOLLOW_SHARE_NOT_ALLOWED });
  });
});

describe('unfollowTarget', () => {
  it('removes the follow and takes one off the counter', async () => {
    addTarget('venue', 'venue1');
    await followTarget(FOLLOW);

    const result = await unfollowTarget('u1', 'venue', 'venue1');

    expect(result.removed).toBe(true);
    expect(counter('venue', 'venue1')).toBe(0);
    expect(follows.size).toBe(0);
  });

  it('decrements once: unfollowing again changes nothing', async () => {
    addTarget('venue', 'venue1');
    await followTarget(FOLLOW);
    await followTarget({ ...FOLLOW, userId: 'u2' });

    await unfollowTarget('u1', 'venue', 'venue1');
    const again = await unfollowTarget('u1', 'venue', 'venue1');

    expect(again.removed).toBe(false);
    expect(counter('venue', 'venue1')).toBe(1);
  });

  it('never decrements for a follow that was never made', async () => {
    addTarget('venue', 'venue1', 5);
    const result = await unfollowTarget('u1', 'venue', 'venue1');
    expect(result.removed).toBe(false);
    expect(counter('venue', 'venue1')).toBe(5);
  });

  it('still removes the follow when the target row is gone', async () => {
    addTarget('venue', 'venue1');
    await followTarget(FOLLOW);
    targets.clear();

    const result = await unfollowTarget('u1', 'venue', 'venue1');

    expect(result.removed).toBe(true);
    expect(follows.size).toBe(0);
  });
});

describe('bulkSetFollows', () => {
  it('follows and unfollows in one call', async () => {
    addTarget('venue', 'venue1');
    addTarget('organiser', 'org1');
    addTarget('artist', 'art1');
    await followTarget({ userId: 'u1', targetType: 'artist', targetId: 'art1' });

    const { results, newFollows } = await bulkSetFollows('u1', {
      targets: [
        { type: 'venue', id: 'venue1', follow: true },
        { type: 'organiser', id: 'org1', follow: true, share: true },
        { type: 'artist', id: 'art1', follow: false },
      ],
    });

    expect(newFollows).toBe(2);
    expect(results.map(r => r.outcome)).toEqual(['followed', 'followed', 'unfollowed']);
    expect(counter('venue', 'venue1')).toBe(1);
    expect(counter('artist', 'art1')).toBe(0);
  });

  it('is safe to send twice', async () => {
    addTarget('venue', 'venue1');
    const input = { targets: [{ type: 'venue' as const, id: 'venue1', follow: true }] };

    await bulkSetFollows('u1', input);
    const second = await bulkSetFollows('u1', input);

    expect(second.newFollows).toBe(0);
    expect(second.results[0].outcome).toBe('already-following');
    expect(counter('venue', 'venue1')).toBe(1);
  });

  it('refuses share on an artist before writing anything', async () => {
    addTarget('venue', 'venue1');

    const outcome = bulkSetFollows('u1', {
      targets: [
        { type: 'venue', id: 'venue1', follow: true },
        { type: 'artist', id: 'art1', follow: true, share: true },
      ],
    });

    await expect(outcome).rejects.toMatchObject({ code: ErrorCode.FOLLOW_SHARE_NOT_ALLOWED });
    expect(follows.size).toBe(0);
    expect(counter('venue', 'venue1')).toBe(0);
  });

  it('reports a missing target on its own and carries on', async () => {
    addTarget('venue', 'venue1');

    const { results } = await bulkSetFollows('u1', {
      targets: [
        { type: 'artist', id: 'missing', follow: true },
        { type: 'venue', id: 'venue1', follow: true },
      ],
    });

    expect(results[0]).toMatchObject({
      outcome: 'error',
      error: ErrorCode.FOLLOW_TARGET_NOT_FOUND,
    });
    expect(results[1].outcome).toBe('followed');
  });

  it('drops the code, and still follows, when the code is unknown or not active', async () => {
    addTarget('venue', 'venue1');
    vi.mocked(getQr).mockResolvedValueOnce(null);
    const first = await bulkSetFollows('u1', {
      qrCode: 'ZZZZZZZZ',
      targets: [{ type: 'venue', id: 'venue1', follow: true }],
    });
    expect(first.newFollows).toBe(1);
    expect(recordQrFollows).not.toHaveBeenCalled();
    expect(rowFor('u1', 'venue', 'venue1')).toMatchObject({ source: 'web' });

    addTarget('venue', 'venue2');
    vi.mocked(getQr).mockResolvedValueOnce({ status: 'retired' } as never);
    await bulkSetFollows('u1', {
      qrCode: 'ABCDEFGH',
      targets: [{ type: 'venue', id: 'venue2', follow: true }],
    });
    expect(recordQrFollows).not.toHaveBeenCalled();
  });

  it('adds only the new follows to the code', async () => {
    addTarget('venue', 'venue1');
    addTarget('organiser', 'org1');
    await followTarget({ userId: 'u1', targetType: 'organiser', targetId: 'org1' });

    await bulkSetFollows('u1', {
      qrCode: 'ABCDEFGH',
      eventId: 'ev1',
      targets: [
        { type: 'venue', id: 'venue1', follow: true },
        { type: 'organiser', id: 'org1', follow: true },
      ],
    });

    expect(recordQrFollows).toHaveBeenCalledWith('ABCDEFGH', 1, expect.any(Date));
  });

  it('does not touch the code when nothing is new', async () => {
    addTarget('venue', 'venue1');
    await followTarget(FOLLOW);

    await bulkSetFollows('u1', {
      qrCode: 'ABCDEFGH',
      targets: [{ type: 'venue', id: 'venue1', follow: true }],
    });

    expect(recordQrFollows).not.toHaveBeenCalled();
  });

  it('keeps the follows when the code is gone', async () => {
    addTarget('venue', 'venue1');
    vi.mocked(recordQrFollows).mockRejectedValueOnce(
      new ApplicationError(ErrorCode.QR_NOT_FOUND, 'gone')
    );

    const { newFollows } = await bulkSetFollows('u1', {
      qrCode: 'ABCDEFGH',
      targets: [{ type: 'venue', id: 'venue1', follow: true }],
    });

    expect(newFollows).toBe(1);
    expect(counter('venue', 'venue1')).toBe(1);
  });
});

describe('getFollowStatus', () => {
  it('answers for every target asked about', async () => {
    addTarget('venue', 'venue1');
    await followTarget(FOLLOW);

    const status = await getFollowStatus('u1', [
      { type: 'venue', id: 'venue1' },
      { type: 'artist', id: 'art1' },
    ]);

    expect(status['venue:venue1']).toMatchObject({ targetId: 'venue1' });
    expect(status['artist:art1']).toBeNull();
  });
});

describe('moveFollows', () => {
  it('moves followers to the canonical target, one row per user, with correct counts', async () => {
    addTarget('organiser', 'loser');
    addTarget('organiser', 'canon');
    for (const userId of ['u1', 'u2', 'u3']) {
      await followTarget({ userId, targetType: 'organiser', targetId: 'loser' });
    }
    // u2 followed both before the merge.
    await followTarget({ userId: 'u2', targetType: 'organiser', targetId: 'canon' });
    expect(counter('organiser', 'loser')).toBe(3);
    expect(counter('organiser', 'canon')).toBe(1);

    const result = await moveFollows('organiser', 'loser', 'canon', 'Canon Sabha');

    expect(result).toEqual({ moved: 2, dropped: 1 });
    const onCanon = [...follows.values()].filter(r => r.targetId === 'canon');
    expect(onCanon.map(r => r.userId).sort()).toEqual(['u1', 'u2', 'u3']);
    expect(onCanon.find(r => r.userId === 'u1')?.targetName).toBe('Canon Sabha');
    expect([...follows.values()].filter(r => r.targetId === 'loser')).toHaveLength(0);
    expect(counter('organiser', 'canon')).toBe(3);
    expect(counter('organiser', 'loser')).toBe(0);
  });

  it('carries source, code, event and consent across', async () => {
    addTarget('venue', 'loser');
    addTarget('venue', 'canon');
    await followTarget(
      {
        userId: 'u1',
        targetType: 'venue',
        targetId: 'loser',
        qrCode: 'ABCDEFGH',
        eventId: 'ev1',
        share: true,
      },
      new Date('2026-11-01T00:00:00.000Z')
    );

    await moveFollows('venue', 'loser', 'canon', 'Canon');

    expect(rowFor('u1', 'venue', 'canon')).toMatchObject({
      source: 'qr',
      qrCode: 'ABCDEFGH',
      eventId: 'ev1',
      shareWithTarget: true,
      shareConsentVersion: 'share-v1',
      createdAt: '2026-11-01T00:00:00.000Z',
    });
  });

  it('refuses to proceed when an existence check came back unprocessed', async () => {
    addTarget('venue', 'loser');
    addTarget('venue', 'canon');
    await followTarget({ userId: 'u1', targetType: 'venue', targetId: 'loser' });
    vi.mocked(FollowEntity.get).mockReturnValue({
      go: vi.fn().mockResolvedValue({ data: [], unprocessed: [{ userId: 'u1' }] }),
    } as never);

    await expect(moveFollows('venue', 'loser', 'canon', 'Canon')).rejects.toThrow('unprocessed');
    expect(rowFor('u1', 'venue', 'loser')).toBeDefined();
  });
});

describe('deleteUserFollows', () => {
  it('removes every follow and decrements each target once', async () => {
    addTarget('venue', 'venue1');
    addTarget('organiser', 'org1');
    addTarget('artist', 'art1');
    await followTarget(FOLLOW);
    await followTarget({ userId: 'u1', targetType: 'organiser', targetId: 'org1' });
    await followTarget({ userId: 'u1', targetType: 'artist', targetId: 'art1' });
    await followTarget({ ...FOLLOW, userId: 'u2' });

    const removed = await deleteUserFollows('u1');

    expect(removed).toBe(3);
    expect(counter('venue', 'venue1')).toBe(1);
    expect(counter('organiser', 'org1')).toBe(0);
    expect(counter('artist', 'art1')).toBe(0);
    expect([...follows.values()].every(r => r.userId === 'u2')).toBe(true);
  });
});

describe('getFollowTargetCards', () => {
  const batch = (data: unknown[], unprocessed?: unknown[]) =>
    ({ go: vi.fn().mockResolvedValue({ data, unprocessed }) }) as never;

  it('reads each type in one batch and keeps only what the row shows', async () => {
    const venueGet = vi
      .spyOn(VenueEntity, 'get')
      .mockReturnValue(
        batch([{ id: 'v1', photoUrl: 'https://cdn/v.jpg', city: ' Chennai ', name: 'drop' }])
      );
    const orgGet = vi
      .spyOn(OrganiserEntity, 'get')
      .mockReturnValue(batch([{ id: 'o1', logoUrl: 'https://cdn/o.png' }]));
    const artistGet = vi
      .spyOn(ArtistEntity, 'get')
      .mockReturnValue(batch([{ id: 'a1', photoUrl: 'https://cdn/a.jpg', instrument: 'vocal' }]));

    const cards = await getFollowTargetCards([
      { targetType: 'venue', targetId: 'v1' },
      { targetType: 'venue', targetId: 'v1' },
      { targetType: 'organiser', targetId: 'o1' },
      { targetType: 'artist', targetId: 'a1' },
    ]);

    expect(venueGet).toHaveBeenCalledTimes(1);
    expect(venueGet).toHaveBeenCalledWith([{ id: 'v1' }]);
    expect(orgGet).toHaveBeenCalledTimes(1);
    expect(artistGet).toHaveBeenCalledTimes(1);
    expect(cards).toEqual({
      'venue:v1': { imageUrl: 'https://cdn/v.jpg', city: 'Chennai', instrument: undefined },
      'organiser:o1': { imageUrl: 'https://cdn/o.png', city: undefined, instrument: undefined },
      'artist:a1': { imageUrl: 'https://cdn/a.jpg', city: undefined, instrument: 'vocal' },
    });
  });

  it('leaves out a missing or deleted target and skips types with no follows', async () => {
    const venueGet = vi
      .spyOn(VenueEntity, 'get')
      .mockReturnValue(
        batch([{ id: 'v2', deletedAt: '2026-01-01T00:00:00.000Z', photoUrl: 'https://cdn/x.jpg' }])
      );
    const orgGet = vi.spyOn(OrganiserEntity, 'get').mockReturnValue(batch([]));
    const artistGet = vi.spyOn(ArtistEntity, 'get');
    artistGet.mockClear();

    const cards = await getFollowTargetCards([
      { targetType: 'venue', targetId: 'v2' },
      { targetType: 'organiser', targetId: 'o-missing' },
    ]);

    expect(venueGet).toHaveBeenCalled();
    expect(orgGet).toHaveBeenCalled();
    expect(artistGet).not.toHaveBeenCalled();
    expect(cards).toEqual({});
  });

  it('retries unprocessed keys rather than dropping those rows', async () => {
    const go = vi
      .fn()
      .mockResolvedValueOnce({ data: [], unprocessed: [{ id: 'v1' }] })
      .mockResolvedValueOnce({ data: [{ id: 'v1', city: 'Pune' }], unprocessed: [] });
    vi.spyOn(VenueEntity, 'get').mockReturnValue({ go } as never);
    const cards = await getFollowTargetCards([{ targetType: 'venue', targetId: 'v1' }]);
    expect(go).toHaveBeenCalledTimes(2);
    expect(cards['venue:v1']?.city).toBe('Pune');
  });
});
