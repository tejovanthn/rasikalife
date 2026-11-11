import { describe, expect, it, vi } from 'vitest';
import { addressesToSuppress } from './bounce';
import { planDigests, planReminders, reminderChannel } from './run';
import type { NotifyDeps, NotifyUser } from './run';
import type { NotifyEvent } from './match';

const user = (id: string, extra: Partial<NotifyUser> = {}): NotifyUser =>
  ({ id, email: `${id}@x.com`, name: id, ...extra }) as NotifyUser;

const event = (id: string, start: string): NotifyEvent => ({
  id,
  title: id,
  startDateTime: start,
  timezone: 'Asia/Kolkata',
  venueId: 'v1',
  venueName: 'Hall',
});

function deps(over: Partial<NotifyDeps> & { users: NotifyUser[]; events: NotifyEvent[] }) {
  const loadFollowers = vi.fn(async (_t: string, id: string) =>
    id === 'v1' ? over.users.map(u => u.id) : []
  );
  const d: NotifyDeps = {
    loadEvents: async () => over.events,
    loadArtists: async () => new Map(),
    loadFollowers,
    loadRsvpUsers: async () => new Map(),
    loadUsers: async ids => over.users.filter(u => ids.includes(u.id)),
    loadLoggedKeys: async () => new Set(),
    loadPushUserIds: async () => new Set(),
    ...over,
  };
  return { d, loadFollowers };
}

const NOW = new Date('2026-11-15T12:30:00Z'); // Sunday 18:00 IST

describe('planDigests', () => {
  it('reads each target once however many events share it', async () => {
    const events = [event('e1', '2026-11-17T13:00:00Z'), event('e2', '2026-11-18T13:00:00Z')];
    const { d, loadFollowers } = deps({ users: [user('u1'), user('u2')], events });
    const run = await planDigests(NOW, d);
    expect(loadFollowers).toHaveBeenCalledTimes(1);
    expect(run.plans).toHaveLength(2);
    expect(run.startDate).toBe('Sun 15 Nov');
    expect(run.endDate).toBe('Sun 29 Nov');
  });

  it('sends nothing when there are no events', async () => {
    const { d } = deps({ users: [user('u1')], events: [] });
    expect((await planDigests(NOW, d)).plans).toEqual([]);
  });

  it('honours preferences and a recent send', async () => {
    const events = [event('e1', '2026-11-17T13:00:00Z')];
    const users = [
      user('on'),
      user('off', { notifyDigest: false }),
      user('noemail', { notifyEmail: false }),
      user('recent', { digestLastSentAt: '2026-11-14T00:00:00Z' }),
    ];
    const { d } = deps({ users, events });
    expect((await planDigests(NOW, d)).plans.map(p => p.user.id)).toEqual(['on']);
  });

  it('ignores events outside the 14 day window', async () => {
    const { d } = deps({ users: [user('u1')], events: [event('far', '2026-12-30T13:00:00Z')] });
    expect((await planDigests(NOW, d)).plans).toEqual([]);
  });
});

describe('planReminders', () => {
  it('keeps tomorrow only, and skips concert-book events', async () => {
    const events = [
      event('tomorrow', '2026-11-16T13:00:00Z'),
      event('logged', '2026-11-16T14:00:00Z'),
      event('today', '2026-11-15T14:00:00Z'),
    ];
    const { d } = deps({
      users: [user('u1')],
      events,
      loadLoggedKeys: async () => new Set(['u1:logged']),
    });
    const plans = await planReminders(NOW, d);
    expect(plans).toHaveLength(1);
    expect(plans[0]?.entries.map(e => e.event.id)).toEqual(['tomorrow']);
    expect(plans[0]?.channel).toBe('email');
  });

  it('sends RSVPed events beyond the cap of three', async () => {
    const events = Array.from({ length: 6 }, (_, i) =>
      event(`e${i}`, `2026-11-16T${String(10 + i).padStart(2, '0')}:00:00Z`)
    );
    const { d } = deps({
      users: [user('u1')],
      events,
      loadRsvpUsers: async () => new Map([['e0', ['u1']], ['e1', ['u1']], ['e2', ['u1']]]),
    });
    const plans = await planReminders(NOW, d);
    expect(plans[0]?.entries).toHaveLength(6);
  });
});

describe('reminderChannel', () => {
  it('is off when reminders are off, email by default, push only with a subscription', () => {
    expect(reminderChannel(user('u', { notifyReminder: false }), false)).toBeNull();
    expect(reminderChannel(user('u'), false)).toBe('email');
    expect(reminderChannel(user('u', { notifyPush: true }), false)).toBe('email');
    expect(reminderChannel(user('u', { notifyPush: true }), true)).toBe('push');
    expect(reminderChannel(user('u', { notifyEmail: false }), false)).toBeNull();
  });
});

describe('addressesToSuppress', () => {
  it('takes hard bounces and complaints, not soft bounces', () => {
    const bounce = (type: string) =>
      JSON.stringify({
        eventType: 'Bounce',
        bounce: { bounceType: type, bouncedRecipients: [{ emailAddress: 'A@x.com' }] },
      });
    expect(addressesToSuppress(bounce('Permanent'))).toEqual(['a@x.com']);
    expect(addressesToSuppress(bounce('Transient'))).toEqual([]);
    expect(
      addressesToSuppress(
        JSON.stringify({
          eventType: 'Complaint',
          complaint: { complainedRecipients: [{ emailAddress: 'b@x.com' }] },
        })
      )
    ).toEqual(['b@x.com']);
    expect(addressesToSuppress('not json')).toEqual([]);
  });
});
