import { TransactWriteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { TransactWriteCommandInput } from '@aws-sdk/lib-dynamodb';
import { ApplicationError, ErrorCode } from '../../constants';
import { TABLE_NAME, dynamoClient } from '../../db/client';
import { keyOfEntity } from '../../db/keys';
import { batchGetAll } from '../../shared/batch-get';
import { ArtistEntity } from '../artist/entity';
import { OrganiserEntity } from '../organiser/entity';
import { getQr, recordQrFollows } from '../venue-qr';
import { CONSENT_VERSIONS } from '../venue-qr/constants';
import { VenueEntity } from '../venue/entity';
import { FollowEntity } from './entity';
import type { Follow } from './entity';
import { canShareWith } from './schema';
import type { BulkSetFollowInput, FollowTargetType } from './schema';
import { resolveFollowTarget } from './target';

export type { Follow } from './entity';
export * from './schema';
export { resolveFollowTarget } from './target';
export * from './purge';

type TransactItem = NonNullable<TransactWriteCommandInput['TransactItems']>[number];
type CancelReason = { Code?: string };

const CONDITION_FAILED = 'ConditionalCheckFailed';

function targetKey(type: FollowTargetType, id: string): { pk: string; sk: string } {
  // Derived from the entity, never hand-built: ElectroDB lowercases key values (rule 7 note in
  // `db/keys.ts`), and an uppercase key would make the ADD below create a phantom row.
  if (type === 'venue') return keyOfEntity(VenueEntity, { id });
  if (type === 'organiser') return keyOfEntity(OrganiserEntity, { id });
  return keyOfEntity(ArtistEntity, { id });
}

/** `ADD followerCount :delta`, guarded so a missing target is refused rather than created. */
function counterUpdate(type: FollowTargetType, id: string, delta: 1 | -1): TransactItem {
  return {
    Update: {
      TableName: TABLE_NAME,
      Key: targetKey(type, id),
      UpdateExpression: 'ADD followerCount :delta',
      ConditionExpression: 'attribute_exists(#pk)',
      ExpressionAttributeNames: { '#pk': 'pk' },
      ExpressionAttributeValues: { ':delta': delta },
    },
  };
}

async function transact(
  items: TransactItem[]
): Promise<{ ok: true } | { ok: false; reasons: CancelReason[] }> {
  try {
    await dynamoClient.send(new TransactWriteCommand({ TransactItems: items }));
    return { ok: true };
  } catch (error) {
    const err = error as { name?: string; CancellationReasons?: CancelReason[] };
    if (err.name === 'TransactionCanceledException') {
      return { ok: false, reasons: err.CancellationReasons ?? [] };
    }
    throw error;
  }
}

const failed = (reason: CancelReason | undefined) => reason?.Code === CONDITION_FAILED;

export async function getFollow(
  userId: string,
  targetType: FollowTargetType,
  targetId: string
): Promise<Follow | null> {
  const result = await FollowEntity.get({ userId, targetType, targetId }).go();
  return (result.data as Follow | null) ?? null;
}

export type FollowInput = {
  userId: string;
  targetType: FollowTargetType;
  targetId: string;
  qrCode?: string;
  eventId?: string;
  /** Venue and organiser only. Sending it for an artist is `FOLLOW_SHARE_NOT_ALLOWED`. */
  share?: boolean;
};

/**
 * Follows a target. One transaction: put the `Follow` (condition: not exists) and
 * `ADD followerCount 1` on the target. A second follow of the same target cancels the whole
 * transaction, so the counter cannot move twice; the call then returns the existing row with
 * `created: false`.
 *
 * A merged target is followed through to its canonical record. A missing or soft-deleted one is
 * `FOLLOW_TARGET_NOT_FOUND`.
 */
export async function followTarget(
  input: FollowInput,
  now: Date = new Date()
): Promise<{ follow: Follow; created: boolean }> {
  if (input.share !== undefined && !canShareWith(input.targetType)) {
    throw new ApplicationError(
      ErrorCode.FOLLOW_SHARE_NOT_ALLOWED,
      'Sharing is only available for venues and organisers'
    );
  }
  const target = await resolveFollowTarget(input.targetType, input.targetId);
  if (!target) {
    throw new ApplicationError(
      ErrorCode.FOLLOW_TARGET_NOT_FOUND,
      `${input.targetType} ${input.targetId} not found`
    );
  }

  const iso = now.toISOString();
  const put = FollowEntity.create({
    userId: input.userId,
    targetType: target.type,
    targetId: target.id,
    targetName: target.name,
    source: input.qrCode ? 'qr' : 'web',
    qrCode: input.qrCode,
    eventId: input.eventId,
    shareWithTarget: input.share === true,
    ...(input.share === true
      ? { shareConsentAt: iso, shareConsentVersion: CONSENT_VERSIONS.share }
      : {}),
    createdAt: iso,
  }).params() as unknown as Record<string, unknown>;

  const outcome = await transact([{ Put: put as never }, counterUpdate(target.type, target.id, 1)]);

  if (outcome.ok) {
    const follow = await getFollow(input.userId, target.type, target.id);
    return { follow: follow as Follow, created: true };
  }

  if (failed(outcome.reasons[0])) {
    // Already following: nothing moved. A share choice still applies.
    const existing = (await getFollow(input.userId, target.type, target.id)) as Follow;
    if (input.share !== undefined && canShareWith(target.type)) {
      const follow = await setFollowShare({
        userId: input.userId,
        targetType: target.type,
        targetId: target.id,
        share: input.share,
      });
      return { follow, created: false };
    }
    return { follow: existing, created: false };
  }
  if (failed(outcome.reasons[1])) {
    throw new ApplicationError(
      ErrorCode.FOLLOW_TARGET_NOT_FOUND,
      `${input.targetType} ${input.targetId} not found`
    );
  }
  throw new ApplicationError(ErrorCode.DATABASE_ERROR, 'Follow transaction was cancelled');
}

/**
 * Removes a follow and decrements the counter once, in one transaction (delete condition:
 * exists). Unfollowing something not followed changes nothing and returns `removed: false`.
 * If the target row is gone, the follow is still removed, without the counter.
 */
export async function unfollowTarget(
  userId: string,
  targetType: FollowTargetType,
  targetId: string
): Promise<{ removed: boolean }> {
  const del = FollowEntity.delete({ userId, targetType, targetId }).params() as unknown as {
    ExpressionAttributeNames?: Record<string, string>;
  };
  const guardedDelete = {
    ...del,
    ConditionExpression: 'attribute_exists(#pk)',
    ExpressionAttributeNames: { ...del.ExpressionAttributeNames, '#pk': 'pk' },
  };

  const outcome = await transact([
    { Delete: guardedDelete as never },
    counterUpdate(targetType, targetId, -1),
  ]);
  if (outcome.ok) return { removed: true };

  if (failed(outcome.reasons[0])) return { removed: false };
  if (failed(outcome.reasons[1])) {
    // The target row is gone; drop the follow alone.
    const alone = await transact([{ Delete: guardedDelete as never }]);
    if (alone.ok) return { removed: true };
    if (failed(alone.reasons[0])) return { removed: false };
  }
  throw new ApplicationError(ErrorCode.DATABASE_ERROR, 'Unfollow transaction was cancelled');
}

/**
 * Grants or withdraws sharing with a venue or organiser. Granting stores the time and the
 * version of the consent text, and removes `shareWithdrawnAt` (`.remove`, rule 8). Withdrawing
 * leaves those two fields as the record of the earlier consent and sets `shareWithdrawnAt`, but
 * only when sharing was on: switching off what was already off must not start a new month's
 * count. The sabha dashboard counts follows whose `shareWithdrawnAt` is in the current month.
 */
export async function setFollowShare(
  input: { userId: string; targetType: FollowTargetType; targetId: string; share: boolean },
  now: Date = new Date()
): Promise<Follow> {
  if (!canShareWith(input.targetType)) {
    throw new ApplicationError(
      ErrorCode.FOLLOW_SHARE_NOT_ALLOWED,
      'Sharing is only available for venues and organisers'
    );
  }
  const { userId, targetType, targetId } = input;
  try {
    if (input.share) {
      const granted = await FollowEntity.patch({ userId, targetType, targetId })
        .set({
          shareWithTarget: true,
          shareConsentAt: now.toISOString(),
          shareConsentVersion: CONSENT_VERSIONS.share,
        })
        .remove(['shareWithdrawnAt'])
        .go({ response: 'all_new' });
      return granted.data as Follow;
    }
    // Withdrawing: only a follow that was sharing records the time.
    const current = await getFollow(userId, targetType, targetId);
    if (!current) {
      throw new ApplicationError(
        ErrorCode.FOLLOW_TARGET_NOT_FOUND,
        `Not following ${targetType} ${targetId}`
      );
    }
    if (current.shareWithTarget !== true) return current;
    const result = await FollowEntity.patch({ userId, targetType, targetId })
      .set({ shareWithTarget: false, shareWithdrawnAt: now.toISOString() })
      .go({ response: 'all_new' });
    return result.data as Follow;
  } catch (error) {
    if (error instanceof ApplicationError) throw error;
    const message = (error as { message?: string }).message ?? '';
    if (message.includes(CONDITION_FAILED) || (error as { code?: number }).code === 4001) {
      throw new ApplicationError(
        ErrorCode.FOLLOW_TARGET_NOT_FOUND,
        `Not following ${targetType} ${targetId}`
      );
    }
    throw error;
  }
}

export type BulkSetResult = {
  type: FollowTargetType;
  id: string;
  outcome: 'followed' | 'already-following' | 'unfollowed' | 'not-following' | 'error';
  error?: ErrorCode;
};

async function usableQrCode(code: string | undefined): Promise<string | undefined> {
  if (!code) return undefined;
  const qr = await getQr(code);
  return qr && qr.status === 'active' ? code : undefined;
}

/**
 * Applies the follow screen's choices. `share` on an artist is refused for the whole call before
 * anything is written. A target that cannot be found is reported in its own result (`error`)
 * and does not stop the rest. New follows made through a code are added to the code's
 * `followCount` and today's `QrScanDay.follows`.
 */
export async function bulkSetFollows(
  userId: string,
  input: BulkSetFollowInput,
  now: Date = new Date()
): Promise<{ results: BulkSetResult[]; newFollows: number }> {
  for (const target of input.targets) {
    if (target.share !== undefined && !canShareWith(target.type)) {
      throw new ApplicationError(
        ErrorCode.FOLLOW_SHARE_NOT_ALLOWED,
        'Sharing is only available for venues and organisers'
      );
    }
  }

  // Attribute follows to a code only when it exists and is active, so `followCount` cannot be
  // inflated for an arbitrary or retired code. A bad code is dropped; the follows still go through.
  const qrCode = await usableQrCode(input.qrCode);

  const results: BulkSetResult[] = [];
  let newFollows = 0;
  for (const target of input.targets) {
    if (!target.follow) {
      const { removed } = await unfollowTarget(userId, target.type, target.id);
      results.push({
        type: target.type,
        id: target.id,
        outcome: removed ? 'unfollowed' : 'not-following',
      });
      continue;
    }
    try {
      const { created } = await followTarget(
        {
          userId,
          targetType: target.type,
          targetId: target.id,
          qrCode,
          eventId: input.eventId,
          share: target.share,
        },
        now
      );
      if (created) newFollows += 1;
      results.push({
        type: target.type,
        id: target.id,
        outcome: created ? 'followed' : 'already-following',
      });
    } catch (error) {
      if (error instanceof ApplicationError && error.code === ErrorCode.FOLLOW_TARGET_NOT_FOUND) {
        results.push({ type: target.type, id: target.id, outcome: 'error', error: error.code });
        continue;
      }
      throw error;
    }
  }

  if (qrCode && newFollows > 0) {
    try {
      await recordQrFollows(qrCode, newFollows, now);
    } catch (error) {
      // The follows are saved; a code that vanished costs only the attribution.
      if (!(error instanceof ApplicationError && error.code === ErrorCode.QR_NOT_FOUND)) {
        throw error;
      }
    }
  }
  return { results, newFollows };
}

/** Everything a user follows, newest first by target. */
export async function listMyFollows(userId: string): Promise<Follow[]> {
  const result = await FollowEntity.query.primary({ userId }).go({ pages: 'all' });
  return (result.data as Follow[]) ?? [];
}

/** What a `/me/following` row shows about its target. All fields are optional. */
export type FollowTargetCard = {
  imageUrl?: string;
  city?: string;
  instrument?: string;
};

type CardRow = {
  id: string;
  photoUrl?: string;
  logoUrl?: string;
  city?: string;
  instrument?: string;
  deletedAt?: string;
};

type BatchEntity = {
  get: (keys: Array<{ id: string }>) => {
    go: (options?: { attributes?: string[] }) => Promise<{
      data?: unknown[] | null;
      unprocessed?: Array<{ id: string }> | null;
    }>;
  };
};

async function readCards(
  entity: BatchEntity,
  ids: string[],
  attributes: string[]
): Promise<CardRow[]> {
  if (ids.length === 0) return [];
  return batchGetAll(
    ids.map(id => ({ id })),
    keys => entity.get(keys).go({ attributes })
  ) as Promise<CardRow[]>;
}

/**
 * The image, city and instrument of every followed target, in one batch read per type (not one
 * get per row). Keys are `${type}:${id}`. A missing or soft-deleted target has no entry, so its
 * row falls back to the stored name. A merged target keeps its own record, which is still there.
 */
export async function getFollowTargetCards(
  follows: Array<Pick<Follow, 'targetType' | 'targetId'>>
): Promise<Record<string, FollowTargetCard>> {
  const idsOf = (type: FollowTargetType) => [
    ...new Set(follows.filter(f => f.targetType === type).map(f => f.targetId)),
  ];
  const [venues, organisers, artists] = await Promise.all([
    readCards(VenueEntity as unknown as BatchEntity, idsOf('venue'), [
      'id',
      'photoUrl',
      'city',
      'deletedAt',
    ]),
    readCards(OrganiserEntity as unknown as BatchEntity, idsOf('organiser'), [
      'id',
      'logoUrl',
      'city',
      'deletedAt',
    ]),
    readCards(ArtistEntity as unknown as BatchEntity, idsOf('artist'), [
      'id',
      'photoUrl',
      'city',
      'instrument',
      'deletedAt',
    ]),
  ]);
  const out: Record<string, FollowTargetCard> = {};
  const add = (type: FollowTargetType, rows: CardRow[]) => {
    for (const row of rows) {
      if (row.deletedAt) continue;
      out[`${type}:${row.id}`] = {
        imageUrl: (type === 'organiser' ? row.logoUrl : row.photoUrl) || undefined,
        city: row.city?.trim() || undefined,
        instrument: type === 'artist' ? row.instrument?.trim() || undefined : undefined,
      };
    }
  };
  add('venue', venues);
  add('organiser', organisers);
  add('artist', artists);
  return out;
}

/** Which of these targets the user follows. Keys are `${type}:${id}`. */
export async function getFollowStatus(
  userId: string,
  targets: Array<{ type: FollowTargetType; id: string }>
): Promise<Record<string, Follow | null>> {
  const out: Record<string, Follow | null> = {};
  for (const t of targets) out[`${t.type}:${t.id}`] = null;
  if (targets.length === 0) return out;

  const result = await FollowEntity.get(
    targets.map(t => ({ userId, targetType: t.type, targetId: t.id }))
  ).go();
  for (const row of (result.data as Follow[]) ?? []) {
    out[`${row.targetType}:${row.targetId}`] = row;
  }
  return out;
}

/** One page of followers of a target, oldest first (gsi1 `byTarget`). */
export async function listFollowersOfTarget(
  targetType: FollowTargetType,
  targetId: string,
  params?: { limit?: number; cursor?: string }
): Promise<{ items: Follow[]; cursor?: string }> {
  const result = await FollowEntity.query
    .byTarget({ targetType, targetId })
    .go({ limit: params?.limit ?? 100, cursor: params?.cursor });
  return { items: (result.data as Follow[]) ?? [], cursor: result.cursor ?? undefined };
}

/** Every follower of a target. For the notification jobs; memoise per run. */
export async function listAllFollowersOfTarget(
  targetType: FollowTargetType,
  targetId: string
): Promise<Follow[]> {
  const result = await FollowEntity.query.byTarget({ targetType, targetId }).go({ pages: 'all' });
  return (result.data as Follow[]) ?? [];
}

export async function getFollowerCount(
  targetType: FollowTargetType,
  targetId: string
): Promise<number> {
  const result =
    targetType === 'venue'
      ? await VenueEntity.get({ id: targetId }).go()
      : targetType === 'organiser'
        ? await OrganiserEntity.get({ id: targetId }).go()
        : await ArtistEntity.get({ id: targetId }).go();
  return (result.data as { followerCount?: number } | null)?.followerCount ?? 0;
}

/**
 * Sets `followerCount` to the number of `Follow` rows that actually exist. Used after a merge,
 * where rows move in bulk. The write is guarded on the target existing.
 */
export async function recomputeFollowerCount(
  targetType: FollowTargetType,
  targetId: string
): Promise<number> {
  const followers = await listAllFollowersOfTarget(targetType, targetId);
  try {
    await dynamoClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: targetKey(targetType, targetId),
        UpdateExpression: 'SET followerCount = :count',
        ConditionExpression: 'attribute_exists(#pk)',
        ExpressionAttributeNames: { '#pk': 'pk' },
        ExpressionAttributeValues: { ':count': followers.length },
      })
    );
  } catch (error) {
    if ((error as { name?: string }).name !== 'ConditionalCheckFailedException') throw error;
  }
  return followers.length;
}

function assertAllProcessed(result: { unprocessed?: unknown[] }): void {
  // An unprocessed key reads as "no follow on the canonical", which would add a second row for
  // a user who already follows it. Failing is safe: the merge is retryable.
  if (result.unprocessed?.length) {
    throw new Error(
      `Follow merge: ${result.unprocessed.length} keys unprocessed in existence check`
    );
  }
}

/**
 * Moves every follow of `loserId` to `canonicalId`: the row is written under the canonical
 * target and removed from the loser in one transaction. A user who already follows the canonical
 * keeps that row and only loses the loser's, so nobody ends up with two. Counters are then
 * recomputed from the rows, for both targets. Called from the merge cascades before the loser is
 * soft-deleted.
 */
export async function moveFollows(
  targetType: FollowTargetType,
  loserId: string,
  canonicalId: string,
  canonicalName: string
): Promise<{ moved: number; dropped: number }> {
  let moved = 0;
  let dropped = 0;
  let cursor: string | null = null;

  do {
    const page = (await FollowEntity.query
      .byTarget({ targetType, targetId: loserId })
      .go({ limit: 100, cursor })) as { data: Follow[]; cursor: string | null };
    const rows = page.data ?? [];
    cursor = page.cursor;

    const existing = rows.length
      ? await FollowEntity.get(
          rows.map(row => ({ userId: row.userId, targetType, targetId: canonicalId }))
        ).go()
      : { data: [] as Follow[], unprocessed: [] as unknown[] };
    assertAllProcessed(existing as { unprocessed?: unknown[] });
    const alreadyOnCanonical = new Set(((existing.data as Follow[]) ?? []).map(r => r.userId));

    for (const row of rows) {
      const del = FollowEntity.delete({
        userId: row.userId,
        targetType,
        targetId: loserId,
      }).params() as unknown as TransactItem['Delete'];

      if (alreadyOnCanonical.has(row.userId)) {
        await dynamoClient.send(new TransactWriteCommand({ TransactItems: [{ Delete: del }] }));
        dropped += 1;
        continue;
      }
      const put = FollowEntity.create({
        userId: row.userId,
        targetType,
        targetId: canonicalId,
        targetName: canonicalName,
        source: row.source,
        qrCode: row.qrCode,
        eventId: row.eventId,
        shareWithTarget: row.shareWithTarget,
        shareConsentAt: row.shareConsentAt,
        shareConsentVersion: row.shareConsentVersion,
        shareWithdrawnAt: row.shareWithdrawnAt,
        createdAt: row.createdAt,
      }).params() as unknown as TransactItem['Put'];
      await dynamoClient.send(
        new TransactWriteCommand({ TransactItems: [{ Put: put }, { Delete: del }] })
      );
      moved += 1;
    }
  } while (cursor);

  await recomputeFollowerCount(targetType, canonicalId);
  await recomputeFollowerCount(targetType, loserId);
  return { moved, dropped };
}

/** Refreshes the denormalized `targetName` on every follow of a renamed target. */
export async function refreshFollowTargetName(
  targetType: FollowTargetType,
  targetId: string,
  newName: string
): Promise<void> {
  let cursor: string | null = null;
  do {
    const page = (await FollowEntity.query
      .byTarget({ targetType, targetId })
      .go({ limit: 100, cursor })) as { data: Follow[]; cursor: string | null };
    cursor = page.cursor;
    await Promise.all(
      (page.data ?? []).map(row =>
        FollowEntity.patch({ userId: row.userId, targetType, targetId })
          .set({ targetName: newName })
          .go()
      )
    );
  } while (cursor);
}

/**
 * Account deletion, follow part: unfollows everything (each one decrements its counter once).
 * Returns the number removed.
 */
export async function deleteUserFollows(userId: string): Promise<number> {
  const follows = await listMyFollows(userId);
  let removed = 0;
  for (const follow of follows) {
    const result = await unfollowTarget(userId, follow.targetType, follow.targetId);
    if (result.removed) removed += 1;
  }
  return removed;
}
