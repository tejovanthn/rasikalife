/**
 * Web push for the day-before reminder (phase 7). Pure parts (the payload, the 410 rule) plus one
 * sender that takes every outside call as a dependency, so tests need no table and no push
 * service. The `web-push` library is wired in by the cron handler, not here.
 */
import { deletePushSubscriptionByHash, listPushSubscriptions } from '../push-subscription';
import { formatTime } from './format';
import type { UserEntry } from './match';

export interface PushPayload {
  title: string;
  body: string;
  /** A site path. The service worker opens it. */
  url: string;
  /** Same tag replaces an earlier reminder on the device instead of stacking. */
  tag: string;
}

const utm = (eventId: string) =>
  new URLSearchParams({
    utm_source: 'push',
    utm_medium: 'push',
    utm_campaign: 'day_before_reminder',
    utm_content: eventId,
  }).toString();

/**
 * Copy "Day-before reminder, push". One event: `Tomorrow at {time}` / `{title}, {venue}`, and a tap
 * opens that event. Two or more: `{count} concerts tomorrow` / `{t1}, {t2} and more`, and a tap
 * opens `/me/following`. Times are in the event's own zone, never the Lambda's.
 */
export function buildReminderPush(entries: UserEntry[]): PushPayload | null {
  const first = entries[0]?.event;
  if (!first) return null;
  if (entries.length === 1) {
    return {
      title: `Tomorrow at ${formatTime(first.startDateTime, first.timezone)}`,
      // TODO(copy): body when the event has no venue name. Only the title is shown.
      body: first.venueName ? `${first.title}, ${first.venueName}` : first.title,
      url: `/events/${first.id}?${utm(first.id)}`,
      tag: 'day-before-reminder',
    };
  }
  const second = entries[1]?.event;
  return {
    title: `${entries.length} concerts tomorrow`,
    body: `${first.title}, ${second?.title ?? ''} and more`,
    url: '/me/following',
    tag: 'day-before-reminder',
  };
}

/** A push service says the endpoint is gone: 410 Gone, or 404 from some services. */
export function isGonePushError(error: unknown): boolean {
  const code = (error as { statusCode?: number } | null)?.statusCode;
  return code === 410 || code === 404;
}

export interface PushTarget {
  endpoint: string;
  endpointHash: string;
  p256dh: string;
  auth: string;
}

export interface PushDeps {
  listSubscriptions(userId: string): Promise<PushTarget[]>;
  /** Sends one payload. Rejects with an error carrying `statusCode` on an HTTP failure. */
  send(target: PushTarget, payload: PushPayload): Promise<void>;
  removeSubscription(userId: string, endpointHash: string): Promise<void>;
}

export const defaultPushDeps = (send: PushDeps['send']): PushDeps => ({
  listSubscriptions: userId => listPushSubscriptions(userId),
  send,
  removeSubscription: deletePushSubscriptionByHash,
});

export interface PushResult {
  delivered: number;
  removed: number;
  failed: number;
}

/**
 * Sends to every subscription the user has (phone and laptop both). A 410 or 404 deletes that
 * row. Any other failure keeps it: a timeout today says nothing about tomorrow. One bad device
 * never stops the others. `delivered === 0` is the caller's cue to fall back to email.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
  deps: PushDeps
): Promise<PushResult> {
  const result: PushResult = { delivered: 0, removed: 0, failed: 0 };
  const targets = await deps.listSubscriptions(userId);
  await Promise.all(
    targets.map(async target => {
      try {
        await deps.send(target, payload);
        result.delivered++;
      } catch (error) {
        if (isGonePushError(error)) {
          try {
            await deps.removeSubscription(userId, target.endpointHash);
            result.removed++;
          } catch (removeError) {
            console.error(`[push] could not delete gone subscription for ${userId}`, removeError);
            result.failed++;
          }
          return;
        }
        console.error(`[push] send failed for ${userId}`, error);
        result.failed++;
      }
    })
  );
  return result;
}
