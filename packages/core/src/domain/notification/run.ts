/**
 * Plans for the weekly digest and the day-before reminder. A plan is "send this to that user":
 * the cron handler renders and sends it. Planning is split from sending so it can be tested
 * without a mailbox, and so phase 7 can choose push in one place.
 */
import { addDaysToDate, todayInTimeZone } from '../../shared/timezone';
import { effectiveNotifyPrefs } from '../user';
import type { User } from '../user/entity';
import { DEFAULT_TIMEZONE } from '../venue-qr/constants';
import {
  loadArtistsForEvents,
  loadEventsInRange,
  loadFollowerIds,
  loadLoggedKeys,
  loadRsvpUsers,
  loadUsers,
  mapLimit,
} from './data';
import { formatDay } from './format';
import {
  buildUserEntries,
  digestRecentlySent,
  digestWindow,
  inWindow,
  reminderQueryWindow,
  selectForDigest,
  selectForReminder,
  startsTomorrow,
  targetKey,
  targetsOfEvent,
  withoutLogged,
} from './match';
import type { FollowType, NotifyEvent, TargetRef, UserEntry } from './match';

export type NotifyUser = Pick<
  User,
  | 'id'
  | 'email'
  | 'name'
  | 'notifyDigest'
  | 'notifyReminder'
  | 'notifyEmail'
  | 'notifyPush'
  | 'unsubscribeToken'
  | 'digestLastSentAt'
>;

/** Every read the jobs make. Tests pass fakes; the default is the real table. */
export interface NotifyDeps {
  loadEvents(from: Date, to: Date): Promise<NotifyEvent[]>;
  loadArtists(
    eventIds: string[]
  ): Promise<Map<string, Array<{ artistId: string; artistName: string }>>>;
  loadFollowers(type: FollowType, id: string): Promise<string[]>;
  loadRsvpUsers(eventIds: string[]): Promise<Map<string, string[]>>;
  loadUsers(ids: string[]): Promise<NotifyUser[]>;
  loadLoggedKeys(pairs: Array<{ userId: string; eventId: string }>): Promise<Set<string>>;
  /**
   * Users with a push subscription. TODO(phase 7): read `PushSubscription` rows. Until then
   * nobody has one, so every reminder goes by email.
   */
  loadPushUserIds(userIds: string[]): Promise<Set<string>>;
}

export const defaultDeps: NotifyDeps = {
  loadEvents: loadEventsInRange,
  loadArtists: loadArtistsForEvents,
  loadFollowers: loadFollowerIds,
  loadRsvpUsers,
  loadUsers,
  loadLoggedKeys,
  loadPushUserIds: async () => new Set(),
};

/** Digest: email only, and only for a user who has not turned off the digest or email. */
export function eligibleForDigest(user: NotifyUser, now: Date): boolean {
  const prefs = effectiveNotifyPrefs(user);
  if (!user.email || !prefs.notifyDigest || !prefs.notifyEmail) return false;
  return !digestRecentlySent(user.digestLastSentAt, now);
}

export type ReminderChannel = 'email' | 'push';

/**
 * The one place that decides how a reminder travels. Push when the user turned it on and has a
 * subscription, else email, else nothing. Phase 7 only has to supply `hasPushSubscription`;
 * until then `loadPushUserIds` is empty and this always answers `email`.
 */
export function reminderChannel(
  user: NotifyUser,
  hasPushSubscription: boolean
): ReminderChannel | null {
  const prefs = effectiveNotifyPrefs(user);
  if (!prefs.notifyReminder) return null;
  if (prefs.notifyPush && hasPushSubscription) return 'push';
  if (prefs.notifyEmail && user.email) return 'email';
  return null;
}

/** `userId -> entries` for these events. Followers are read once per distinct target. */
export async function gatherUserEntries(
  events: NotifyEvent[],
  deps: NotifyDeps
): Promise<Map<string, UserEntry[]>> {
  const eventIds = events.map(e => e.id);
  const [artistsByEvent, rsvpUsersByEvent] = await Promise.all([
    deps.loadArtists(eventIds),
    deps.loadRsvpUsers(eventIds),
  ]);

  const targetsByEvent = new Map<string, TargetRef[]>();
  const distinct = new Map<string, TargetRef>();
  for (const event of events) {
    const targets = targetsOfEvent(event, artistsByEvent.get(event.id) ?? []);
    targetsByEvent.set(event.id, targets);
    for (const target of targets) distinct.set(targetKey(target), target);
  }

  // The same sabha appears on many events, so each target is read once for the whole run.
  const followers = await mapLimit([...distinct.values()], 8, async target => {
    return [targetKey(target), await deps.loadFollowers(target.type, target.id)] as const;
  });

  return buildUserEntries({
    events,
    targetsByEvent,
    followersByTarget: new Map(followers),
    rsvpUsersByEvent,
  });
}

export interface DigestPlan {
  user: NotifyUser;
  shown: UserEntry[];
  total: number;
}

export interface DigestRun {
  /** `Sat 16 Nov`, for the subject line. */
  startDate: string;
  endDate: string;
  plans: DigestPlan[];
}

/** Weekly digest: events in the next 14 days. A user with nothing gets no plan. */
export async function planDigests(now: Date, deps: NotifyDeps = defaultDeps): Promise<DigestRun> {
  const window = digestWindow(now);
  const today = todayInTimeZone(DEFAULT_TIMEZONE, now);
  const run: DigestRun = {
    startDate: formatDay(now, DEFAULT_TIMEZONE),
    endDate: formatDay(`${addDaysToDate(today, 14)}T12:00:00+05:30`, DEFAULT_TIMEZONE),
    plans: [],
  };

  const events = (await deps.loadEvents(window.from, window.to)).filter(e => inWindow(e, window));
  if (events.length === 0) return run;

  const entries = await gatherUserEntries(events, deps);
  const users = await deps.loadUsers([...entries.keys()]);
  for (const user of users) {
    if (!eligibleForDigest(user, now)) continue;
    const { shown, total } = selectForDigest(entries.get(user.id) ?? []);
    if (shown.length === 0) continue;
    run.plans.push({ user, shown, total });
  }
  return run;
}

export interface ReminderPlan {
  user: NotifyUser;
  entries: UserEntry[];
  channel: ReminderChannel;
}

/**
 * Day-before reminders: events starting tomorrow by each event's own clock. RSVPed events always
 * send and sit outside the cap of 3. Events already in the user's concert book are dropped
 * before the cap, so the cap fills with events they can still go to.
 */
export async function planReminders(
  now: Date,
  deps: NotifyDeps = defaultDeps
): Promise<ReminderPlan[]> {
  const window = reminderQueryWindow(now);
  const events = (await deps.loadEvents(window.from, window.to)).filter(e =>
    startsTomorrow(e, now)
  );
  if (events.length === 0) return [];

  const entries = await gatherUserEntries(events, deps);
  const users = await deps.loadUsers([...entries.keys()]);
  const pushUsers = await deps.loadPushUserIds(users.map(u => u.id));

  const eligible = users
    .map(user => ({ user, channel: reminderChannel(user, pushUsers.has(user.id)) }))
    .filter((u): u is { user: NotifyUser; channel: ReminderChannel } => u.channel !== null);

  const pairs = eligible.flatMap(({ user }) =>
    (entries.get(user.id) ?? []).map(e => ({ userId: user.id, eventId: e.event.id }))
  );
  const logged = await deps.loadLoggedKeys(pairs);

  const plans: ReminderPlan[] = [];
  for (const { user, channel } of eligible) {
    const kept = withoutLogged(user.id, entries.get(user.id) ?? [], logged);
    const selected = selectForReminder(kept);
    if (selected.length > 0) plans.push({ user, entries: selected, channel });
  }
  return plans;
}
