import { describe, expect, it, vi } from 'vitest';
import {
  dayBeforeReminderEmail,
  deliverDigests,
  deliverReminders,
  weeklyDigestEmail,
} from './notify';

const link = { siteUrl: 'https://rasika.life', turnOffToken: 'T1', unsubscribeAllToken: 'T2' };
const event = (id: string, title: string, venueName = 'Narada Gana Sabha') => ({
  id,
  title,
  startDateTime: '2026-11-16T12:30:00Z',
  timezone: 'Asia/Kolkata',
  venueName,
});
const entry = (id: string, title: string, reasons: never[] = []) => ({
  event: event(id, title),
  reasons,
  score: 1,
  rsvp: false,
});

describe('weeklyDigestEmail', () => {
  it('uses the Copy subject, heading, event lines and footer', async () => {
    const mail = await weeklyDigestEmail({
      ...link,
      startDate: 'Sun 15 Nov',
      endDate: 'Sun 29 Nov',
      total: 1,
      shown: [
        {
          ...entry('e1', 'Vocal concert'),
          reasons: [{ kind: 'rsvp' }],
          rsvp: true,
        } as never,
      ],
    });
    expect(mail.subject).toBe('Concerts for you: Sun 15 Nov to Sun 29 Nov');
    expect(mail.html).toContain('Coming up in the next two weeks');
    expect(mail.html).toContain('Mon 16 Nov, 6:00 pm');
    expect(mail.html).toContain('Narada Gana Sabha');
    expect(mail.html).toContain('You said you&#x27;re going');
    expect(mail.html).toContain('View concert');
    expect(mail.html).toContain('utm_campaign=weekly_digest');
    expect(mail.html).toContain('Manage what you follow');
    expect(mail.html).toContain('Turn off this email');
    expect(mail.html).toContain('Unsubscribe from all email');
    expect(mail.html).toContain('/unsubscribe/T1');
    expect(mail.html).toContain('/unsubscribe/T2');
    expect(mail.html).not.toContain('See all');
    expect(mail.unsubscribeUrl).toBe('https://rasika.life/unsubscribe/T1');
    expect(mail.text).not.toContain('<');
  });

  it('adds the more link when events were cut', async () => {
    const mail = await weeklyDigestEmail({
      ...link,
      startDate: 'a',
      endDate: 'b',
      total: 18,
      shown: [entry('e1', 'One') as never],
    });
    expect(mail.html).toContain('See all 18 concerts on rasika.life');
  });
});

describe('dayBeforeReminderEmail', () => {
  it('has the one-event subject and preheader', async () => {
    const mail = await dayBeforeReminderEmail({
      ...link,
      entries: [entry('e1', 'Vocal') as never],
    });
    expect(mail.subject).toBe('Tomorrow: Vocal at Narada Gana Sabha');
    expect(mail.html).toContain('Starts 6:00 pm at Narada Gana Sabha');
    expect(mail.html).toContain('Vocal, 6:00 pm at Narada Gana Sabha.');
    expect(mail.html).toContain('utm_campaign=day_before_reminder');
  });

  it('counts events in the many-event subject', async () => {
    const mail = await dayBeforeReminderEmail({
      ...link,
      entries: [entry('e1', 'A') as never, entry('e2', 'B') as never],
    });
    expect(mail.subject).toBe('Tomorrow: 2 concerts you follow');
  });
});

describe('deliver', () => {
  const user = { id: 'u1', email: 'u1@x.com', name: 'U' };
  const deps = () => ({
    siteUrl: 'https://rasika.life',
    secret: 's',
    send: vi.fn().mockResolvedValue(undefined),
    tokenFor: vi.fn().mockResolvedValue('tok'),
    markDigestSent: vi.fn().mockResolvedValue(undefined),
    markReminderSent: vi.fn().mockResolvedValue(undefined),
  });

  it('sends a digest, marks it sent, and survives one failure', async () => {
    const d = deps();
    d.send.mockRejectedValueOnce(new Error('ses down'));
    const plan = { user: user as never, shown: [entry('e1', 'A') as never], total: 1 };
    const result = await deliverDigests(
      {
        startDate: 'a',
        endDate: 'b',
        plans: [plan, { ...plan, user: { ...user, id: 'u2' } as never }],
      },
      d
    );
    expect(result).toEqual({ sent: 1, failed: 1 });
    expect(d.markDigestSent).toHaveBeenCalledTimes(1);
    expect(d.send.mock.calls[0]?.[0].unsubscribeUrl).toMatch(/\/unsubscribe\//);
  });

  it('records the target day after an email reminder', async () => {
    const d = deps();
    const plan = {
      user: user as never,
      entries: [entry('e1', 'A') as never],
      channel: 'email' as const,
      targetDay: '2026-11-16',
    };
    expect(await deliverReminders([plan], d)).toEqual({ sent: 1, failed: 0 });
    expect(d.markReminderSent).toHaveBeenCalledWith('u1', '2026-11-16');
  });

  const pushPlan = (u: object = user) => [
    {
      user: u as never,
      entries: [entry('e1', 'A') as never],
      channel: 'push' as const,
      targetDay: '2026-11-16',
    },
  ];
  const target = { endpoint: 'https://p/1', endpointHash: 'h1', p256dh: 'k', auth: 'a' };
  const pushDeps = (send: ReturnType<typeof vi.fn>, targets = [target]) => ({
    listSubscriptions: vi.fn().mockResolvedValue(targets),
    send,
    removeSubscription: vi.fn().mockResolvedValue(undefined),
  });

  it('sends a push plan by push and sends no email', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const push = pushDeps(send);
    const d = { ...deps(), push: push as never };
    const result = await deliverReminders(pushPlan(), d);
    expect(result).toEqual({ sent: 1, failed: 0 });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[1].title).toBe('Tomorrow at 6:00 pm');
    expect(d.send).not.toHaveBeenCalled();
  });

  it('falls back to email when every push fails', async () => {
    const gone = Object.assign(new Error('gone'), { statusCode: 410 });
    const push = pushDeps(vi.fn().mockRejectedValue(gone));
    const d = { ...deps(), push: push as never };
    const result = await deliverReminders(pushPlan(), d);
    expect(result).toEqual({ sent: 1, failed: 0 });
    expect(push.removeSubscription).toHaveBeenCalledWith('u1', 'h1');
    expect(d.send).toHaveBeenCalledTimes(1);
  });

  it('does not fall back when the user turned email off', async () => {
    const d = { ...deps(), push: pushDeps(vi.fn().mockRejectedValue(new Error('x'))) as never };
    const result = await deliverReminders(pushPlan({ ...user, notifyEmail: false }), d);
    expect(result).toEqual({ sent: 0, failed: 1 });
    expect(d.send).not.toHaveBeenCalled();
  });
});
