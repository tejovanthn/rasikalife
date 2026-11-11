import { Notification } from '@rasika/core';
import type { Notification as NotificationTypes } from '@rasika/core';
import { render } from '@react-email/render';
import DayBeforeReminderEmail from '../emails/day-before-reminder';
import WeeklyDigestEmail from '../emails/weekly-digest';

type UserEntry = NotificationTypes.UserEntry;

export interface NotifyEmailContent {
  subject: string;
  html: string;
  text: string;
  /** The one-click https link for this email's own kind. Goes in `List-Unsubscribe`. */
  unsubscribeUrl: string;
}

export interface NotifyLinkInput {
  siteUrl: string;
  /** Signed unsubscribe links, one for this email's kind and one for all email. */
  turnOffToken: string;
  unsubscribeAllToken: string;
}

const clean = (url: string) => url.replace(/\/+$/, '');

/** UTM tags on an event link: source email, campaign per job, content the event id. */
export function eventLink(siteUrl: string, eventId: string, campaign: string): string {
  const params = new URLSearchParams({
    utm_source: 'email',
    utm_medium: 'email',
    utm_campaign: campaign,
    utm_content: eventId,
  });
  return `${clean(siteUrl)}/events/${eventId}?${params}`;
}

function footerLinks(input: NotifyLinkInput) {
  const site = clean(input.siteUrl);
  return {
    manageUrl: `${site}/me/following`,
    turnOffUrl: `${site}/unsubscribe/${input.turnOffToken}`,
    unsubscribeAllUrl: `${site}/unsubscribe/${input.unsubscribeAllToken}`,
  };
}

async function renderBoth(element: React.ReactElement) {
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);
  return { html, text };
}

export interface DigestEmailInput extends NotifyLinkInput {
  /** `Sat 16 Nov`, from `planDigests`. */
  startDate: string;
  endDate: string;
  shown: UserEntry[];
  total: number;
}

export async function weeklyDigestEmail(input: DigestEmailInput): Promise<NotifyEmailContent> {
  const site = clean(input.siteUrl);
  const events = input.shown.map(({ event, reasons }) => {
    const day = Notification.formatDay(event.startDateTime, event.timezone);
    const time = Notification.formatTime(event.startDateTime, event.timezone);
    return {
      title: event.title,
      when: `${day}, ${time}${event.venueName ? ` · ${event.venueName}` : ''}`,
      reason: Notification.reasonLine(reasons),
      url: eventLink(site, event.id, 'weekly_digest'),
    };
  });
  const element = (
    <WeeklyDigestEmail
      preheader={`${input.total} concerts from artists, sabhas and venues you follow`}
      events={events}
      more={
        input.total > input.shown.length
          ? { label: `See all ${input.total} concerts on rasika.life`, url: `${site}/events` }
          : undefined
      }
      siteUrl={site}
      {...footerLinks(input)}
    />
  );
  return {
    subject: `Concerts for you: ${input.startDate} to ${input.endDate}`,
    ...(await renderBoth(element)),
    unsubscribeUrl: `${site}/unsubscribe/${input.turnOffToken}`,
  };
}

export interface ReminderEmailInput extends NotifyLinkInput {
  entries: UserEntry[];
}

export async function dayBeforeReminderEmail(
  input: ReminderEmailInput
): Promise<NotifyEmailContent> {
  const site = clean(input.siteUrl);
  const first = input.entries[0]?.event;
  const events = input.entries.map(({ event, reasons }) => {
    const time = Notification.formatTime(event.startDateTime, event.timezone);
    return {
      line: `${event.title}, ${time}${event.venueName ? ` at ${event.venueName}` : ''}.`,
      reason: Notification.reasonLine(reasons),
      url: eventLink(site, event.id, 'day_before_reminder'),
    };
  });
  const firstTime = first ? Notification.formatTime(first.startDateTime, first.timezone) : '';
  const subject =
    input.entries.length === 1 && first
      ? // TODO(copy): subject when the event has no venue name.
        `Tomorrow: ${first.title}${first.venueName ? ` at ${first.venueName}` : ''}`
      : `Tomorrow: ${input.entries.length} concerts you follow`;
  const element = (
    <DayBeforeReminderEmail
      preheader={`Starts ${firstTime}${first?.venueName ? ` at ${first.venueName}` : ''}`}
      events={events}
      siteUrl={site}
      {...footerLinks(input)}
    />
  );
  return {
    subject,
    ...(await renderBoth(element)),
    unsubscribeUrl: `${site}/unsubscribe/${input.turnOffToken}`,
  };
}

/** What `deliver*` needs from the outside. Tests pass fakes. */
export interface DeliverDeps {
  siteUrl: string;
  secret: string;
  send(input: {
    to: string;
    subject: string;
    html: string;
    text: string;
    unsubscribeUrl: string;
  }): Promise<void>;
  /** The user's stored token; creates one for a row from before the field existed. */
  tokenFor(user: { id: string; unsubscribeToken?: string }): Promise<string>;
  markDigestSent?(userId: string): Promise<void>;
  /** Web push, from the cron handler. Without it a `push` plan goes by email. */
  push?: NotificationTypes.PushDeps;
}

export interface DeliverResult {
  sent: number;
  failed: number;
}

async function links(
  user: { id: string; unsubscribeToken?: string },
  kind: 'digest' | 'reminders',
  deps: DeliverDeps
): Promise<NotifyLinkInput> {
  const token = await deps.tokenFor(user);
  return {
    siteUrl: deps.siteUrl,
    turnOffToken: Notification.signUnsubscribeToken({ userId: user.id, kind, token }, deps.secret),
    unsubscribeAllToken: Notification.signUnsubscribeToken(
      { userId: user.id, kind: 'all', token },
      deps.secret
    ),
  };
}

async function inBatches<T>(items: T[], size: number, fn: (item: T) => Promise<boolean>) {
  const result: DeliverResult = { sent: 0, failed: 0 };
  for (let i = 0; i < items.length; i += size) {
    const outcomes = await Promise.all(items.slice(i, i + size).map(fn));
    for (const ok of outcomes) ok ? result.sent++ : result.failed++;
  }
  return result;
}

/** One failed address never stops the run. */
export function deliverDigests(
  run: NotificationTypes.DigestRun,
  deps: DeliverDeps
): Promise<DeliverResult> {
  return inBatches(run.plans, 5, async plan => {
    try {
      const content = await weeklyDigestEmail({
        ...(await links(plan.user, 'digest', deps)),
        startDate: run.startDate,
        endDate: run.endDate,
        shown: plan.shown,
        total: plan.total,
      });
      await deps.send({ to: plan.user.email, ...content });
      await deps.markDigestSent?.(plan.user.id);
      return true;
    } catch (error) {
      console.error(`[digest] failed for user ${plan.user.id}`, error);
      return false;
    }
  });
}

export function deliverReminders(
  plans: NotificationTypes.ReminderPlan[],
  deps: DeliverDeps
): Promise<DeliverResult> {
  return inBatches(plans, 5, async plan => {
    if (plan.channel === 'push') {
      const pushed = await tryPush(plan, deps);
      if (pushed) return true;
      // Every device failed or none was left (a 410 just deleted the last one). Fall back to
      // email when the user allows it, so a dead subscription never costs them the reminder.
      if (Notification.reminderChannel(plan.user, false) !== 'email') return false;
    }
    try {
      const content = await dayBeforeReminderEmail({
        ...(await links(plan.user, 'reminders', deps)),
        entries: plan.entries,
      });
      await deps.send({ to: plan.user.email, ...content });
      return true;
    } catch (error) {
      console.error(`[reminder] failed for user ${plan.user.id}`, error);
      return false;
    }
  });
}

/** True when at least one of the user's devices took the push. */
async function tryPush(plan: NotificationTypes.ReminderPlan, deps: DeliverDeps): Promise<boolean> {
  const payload = Notification.buildReminderPush(plan.entries);
  if (!deps.push || !payload) return false;
  try {
    const result = await Notification.sendPushToUser(plan.user.id, payload, deps.push);
    return result.delivered > 0;
  } catch (error) {
    console.error(`[reminder] push failed for user ${plan.user.id}`, error);
    return false;
  }
}
