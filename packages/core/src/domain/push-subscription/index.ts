import { createHash } from 'node:crypto';
import { ApplicationError, ErrorCode } from '../../constants';
import { PushSubscriptionEntity } from './entity';
import type { PushSubscription } from './entity';
import { SubscribePushSchema } from './schema';
import type { SubscribePushInput } from './schema';

export type { PushSubscription } from './entity';
export * from './schema';

/** sha256 of the endpoint URL, hex. The sort key of the row. */
export function hashEndpoint(endpoint: string): string {
  return createHash('sha256').update(endpoint).digest('hex');
}

/**
 * Stores a browser's endpoint. A bad endpoint or missing keys is `PUSH_SUBSCRIPTION_INVALID`.
 * `put`, not `upsert` (rule 8): a re-subscribe from the same browser replaces the keys outright.
 */
export async function putPushSubscription(
  userId: string,
  input: SubscribePushInput,
  userAgent?: string
): Promise<PushSubscription> {
  const parsed = SubscribePushSchema.safeParse(input);
  if (!parsed.success || !parsed.data.endpoint.startsWith('https://')) {
    throw new ApplicationError(
      ErrorCode.PUSH_SUBSCRIPTION_INVALID,
      'Push subscription needs an https endpoint and both keys'
    );
  }
  const { endpoint, keys } = parsed.data;
  const result = await PushSubscriptionEntity.put({
    userId,
    endpointHash: hashEndpoint(endpoint),
    endpoint,
    p256dh: keys.p256dh,
    auth: keys.auth,
    userAgent,
  }).go();
  return result.data as PushSubscription;
}

export async function deletePushSubscription(userId: string, endpoint: string): Promise<void> {
  await PushSubscriptionEntity.delete({ userId, endpointHash: hashEndpoint(endpoint) }).go();
}

/** For the sender: a `410 Gone` from the push service deletes the row by its hash. */
export async function deletePushSubscriptionByHash(
  userId: string,
  endpointHash: string
): Promise<void> {
  await PushSubscriptionEntity.delete({ userId, endpointHash }).go();
}

export async function listPushSubscriptions(userId: string): Promise<PushSubscription[]> {
  const result = await PushSubscriptionEntity.query.primary({ userId }).go({ pages: 'all' });
  return (result.data as PushSubscription[]) ?? [];
}

/** Account deletion: removes every endpoint the user registered. */
export async function deleteUserPushSubscriptions(userId: string): Promise<number> {
  const subscriptions = await listPushSubscriptions(userId);
  await Promise.all(subscriptions.map(s => deletePushSubscriptionByHash(userId, s.endpointHash)));
  return subscriptions.length;
}
