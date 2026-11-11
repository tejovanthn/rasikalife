import { describe, expect, it, vi } from 'vitest';

vi.mock('../push-subscription', () => ({
  listPushSubscriptions: vi.fn(),
  deletePushSubscriptionByHash: vi.fn(),
}));

import { buildReminderPush, isGonePushError, sendPushToUser } from './push';
import type { PushDeps, PushTarget } from './push';

const entry = (
  id: string,
  title: string,
  venueName?: string,
  startDateTime = '2026-11-16T12:30:00Z'
) =>
  ({
    event: { id, title, startDateTime, timezone: 'Asia/Kolkata', venueName },
    reasons: [],
    score: 1,
    rsvp: false,
  }) as never;

describe('buildReminderPush', () => {
  it('one event: time in the event zone, title and venue, opens the event', () => {
    const p = buildReminderPush([entry('e1', 'Vocal concert', 'Narada Gana Sabha')]);
    expect(p?.title).toBe('Tomorrow at 6:00 pm');
    expect(p?.body).toBe('Vocal concert, Narada Gana Sabha');
    expect(p?.url).toMatch(/^\/events\/e1\?/);
    expect(p?.url).toContain('utm_source=push');
  });

  it('one event without a venue shows the title alone', () => {
    expect(buildReminderPush([entry('e1', 'Vocal concert')])?.body).toBe('Vocal concert');
  });

  it('two or more: count, first two titles, opens /me/following', () => {
    const p = buildReminderPush([entry('a', 'One'), entry('b', 'Two'), entry('c', 'Three')]);
    expect(p).toMatchObject({
      title: '3 concerts tomorrow',
      body: 'One, Two and more',
      url: '/me/following',
    });
  });

  it('is null for no events', () => {
    expect(buildReminderPush([])).toBeNull();
  });
});

describe('isGonePushError', () => {
  it('is true for 410 and 404 only', () => {
    expect(isGonePushError({ statusCode: 410 })).toBe(true);
    expect(isGonePushError({ statusCode: 404 })).toBe(true);
    expect(isGonePushError({ statusCode: 500 })).toBe(false);
    expect(isGonePushError(new Error('x'))).toBe(false);
    expect(isGonePushError(null)).toBe(false);
  });
});

describe('sendPushToUser', () => {
  const t = (n: number): PushTarget => ({
    endpoint: `https://p/${n}`,
    endpointHash: `h${n}`,
    p256dh: 'k',
    auth: 'a',
  });
  const payload = { title: 't', body: 'b', url: '/u', tag: 'x' };
  const deps = (send: PushDeps['send'], targets: PushTarget[]) => ({
    listSubscriptions: vi.fn().mockResolvedValue(targets),
    send,
    removeSubscription: vi.fn().mockResolvedValue(undefined),
  });

  it('sends to every subscription', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const d = deps(send, [t(1), t(2)]);
    expect(await sendPushToUser('u1', payload, d)).toEqual({ delivered: 2, removed: 0, failed: 0 });
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('410 Gone deletes that subscription and keeps the others', async () => {
    const send = vi.fn(async (target: PushTarget) => {
      if (target.endpointHash === 'h1') throw Object.assign(new Error('gone'), { statusCode: 410 });
    });
    const d = deps(send, [t(1), t(2)]);
    expect(await sendPushToUser('u1', payload, d)).toEqual({ delivered: 1, removed: 1, failed: 0 });
    expect(d.removeSubscription).toHaveBeenCalledTimes(1);
    expect(d.removeSubscription).toHaveBeenCalledWith('u1', 'h1');
  });

  it('404 also deletes', async () => {
    const send = vi.fn().mockRejectedValue(Object.assign(new Error('nf'), { statusCode: 404 }));
    const d = deps(send, [t(1)]);
    await sendPushToUser('u1', payload, d);
    expect(d.removeSubscription).toHaveBeenCalledWith('u1', 'h1');
  });

  it('a 500 keeps the subscription and counts a failure', async () => {
    const send = vi.fn().mockRejectedValue(Object.assign(new Error('down'), { statusCode: 500 }));
    const d = deps(send, [t(1)]);
    expect(await sendPushToUser('u1', payload, d)).toEqual({ delivered: 0, removed: 0, failed: 1 });
    expect(d.removeSubscription).not.toHaveBeenCalled();
  });
});
