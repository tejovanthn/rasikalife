import { Email, Notification, User } from '@rasika/core';
import { deliverDigests, deliverReminders } from '@rasika/email';
import type { DeliverDeps } from '@rasika/email';

/**
 * Cron and SNS entry points for the Venue QR Follow notifications (phase 5). Thin on purpose:
 * planning is `Notification.planDigests` / `planReminders` in core, rendering and sending is
 * `@rasika/email`.
 *
 * Both crons run in UTC (`infra/notify.ts`); day boundaries are decided per event in the event's
 * own zone inside core, never from this Lambda's clock.
 */

function deps(): DeliverDeps {
  const secret = process.env.UNSUBSCRIBE_SECRET;
  if (!secret) throw new Error('UNSUBSCRIBE_SECRET is unset');
  return {
    siteUrl: process.env.SITE_URL || 'https://rasika.life',
    secret,
    send: input => Email.sendBulk(input),
    tokenFor: user => (user.unsubscribeToken ? Promise.resolve(user.unsubscribeToken) : User.getOrCreateUnsubscribeToken(user.id)),
    markDigestSent: userId => User.setDigestLastSentAt(userId),
  };
}

/** Sunday 18:00 IST. Not sent when a user has no events: the plan list is empty then. */
export async function digestHandler(): Promise<void> {
  const run = await Notification.planDigests(new Date());
  console.log(`Digest: ${run.plans.length} users have events for ${run.startDate} to ${run.endDate}`);
  if (run.plans.length === 0) return;
  const result = await deliverDigests(run, deps());
  console.log(`Digest: sent ${result.sent}, failed ${result.failed}`);
}

/** Daily 18:00 IST. Email only for now; `plan.channel === 'push'` is a phase 7 seam. */
export async function reminderHandler(): Promise<void> {
  const plans = await Notification.planReminders(new Date());
  console.log(`Reminders: ${plans.length} users have events tomorrow`);
  if (plans.length === 0) return;
  const result = await deliverReminders(plans, deps());
  console.log(`Reminders: sent ${result.sent}, failed ${result.failed}`);
}

interface SnsRecord {
  Sns?: { Message?: string };
}

/**
 * SES bounce and complaint events, via SNS. A hard bounce or a complaint sets
 * `notifyEmail = false` for the user with that address. Throws on a lookup failure so SNS
 * retries; an unknown address is a no-op.
 */
export async function emailEventsHandler(event: { Records?: SnsRecord[] }): Promise<void> {
  for (const record of event.Records ?? []) {
    for (const address of Notification.addressesToSuppress(record.Sns?.Message ?? '')) {
      const found = await Notification.suppressEmail(address);
      console.log(`Email event: notifyEmail off for ${address}: ${found ? 'user found' : 'no user'}`);
    }
  }
}
