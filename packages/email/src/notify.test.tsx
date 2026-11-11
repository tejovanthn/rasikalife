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

  it('does not email a push plan', async () => {
    const d = deps();
    await deliverReminders(
      [{ user: user as never, entries: [entry('e1', 'A') as never], channel: 'push' }],
      d
    );
    expect(d.send).not.toHaveBeenCalled();
  });
});
