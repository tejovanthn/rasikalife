/**
 * SES event publishing to SNS, reduced to "which addresses must stop getting mail".
 *
 * Only a permanent (hard) bounce and a complaint count. A transient bounce (full mailbox, a
 * server down) is retried by SES and says nothing about the address.
 */
import { getUserByEmail, setNotifyPrefs } from '../user';

interface SesEvent {
  eventType?: string;
  bounce?: { bounceType?: string; bouncedRecipients?: Array<{ emailAddress?: string }> };
  complaint?: { complainedRecipients?: Array<{ emailAddress?: string }> };
}

/** Lowercase addresses to switch off, from the JSON in one SNS message. Bad input gives none. */
export function addressesToSuppress(messageBody: string): string[] {
  let event: SesEvent;
  try {
    event = JSON.parse(messageBody) as SesEvent;
  } catch {
    return [];
  }
  const found: Array<{ emailAddress?: string }> = [];
  if (event.eventType === 'Bounce' && event.bounce?.bounceType === 'Permanent') {
    found.push(...(event.bounce.bouncedRecipients ?? []));
  } else if (event.eventType === 'Complaint') {
    found.push(...(event.complaint?.complainedRecipients ?? []));
  }
  const emails = found
    .map(r => r.emailAddress?.trim().toLowerCase())
    .filter((e): e is string => Boolean(e));
  return [...new Set(emails)];
}

/**
 * Sets `notifyEmail = false` for the user with this address. Returns whether a user was found.
 * An address that is not ours (a forwarded copy, a typo) is a no-op.
 */
export async function suppressEmail(email: string): Promise<boolean> {
  const user = await getUserByEmail(email);
  if (!user) return false;
  await setNotifyPrefs(user.id, { notifyEmail: false });
  return true;
}
