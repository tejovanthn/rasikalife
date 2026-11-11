import type { UnsubscribeKind } from '@rasika/core/domain/notification/client';

/**
 * Pure helpers for `/me/notifications` and `/unsubscribe/:token`. Strings come from
 * `docs/plans/261112-01-venue-qr-follow/copy.md`.
 */

export const NOTIFY_COPY = {
  pageTitle: 'Notifications',
  digest: 'Weekly list of concerts (Sunday evening)',
  reminder: 'Reminder the day before',
  email: 'Email',
  push: 'Push notifications on this device',
  whatsappAdd: 'Add WhatsApp number',
  whatsappRemove: 'Remove number',
  saved: 'Settings saved.',
  whatsappHeading: 'Get updates on WhatsApp',
  whatsappLabel: 'WhatsApp number (optional)',
  whatsappPrefix: '+91',
  whatsappPlaceholder: '98450 12345',
  whatsappConsent: 'rasika.life may message me on this number about concerts I follow.',
  whatsappSave: 'Save number',
  whatsappInvalid: 'Enter a 10-digit mobile number.',
  whatsappConsentMissing: 'Tick the box to let us message this number.',
  whatsappSaved: "Saved. We'll confirm this number before messaging you.",
} as const;

export const whatsappUnconfirmed = (number: string) => `${number} (not yet confirmed)`;

export const UNSUBSCRIBE_COPY = {
  digest: "You won't get the weekly list any more.",
  reminders: "You won't get day-before reminders by email any more.",
  all: "You're unsubscribed from all rasika.life email.",
  changedMind: 'Changed your mind?',
  manage: 'Manage notifications',
  expired: 'This link has expired. Sign in to manage notifications.',
  // TODO(copy): the button on the confirm step. A GET must not unsubscribe, because a link
  // scanner can open the link, so the page asks first and Copy has no wording for it.
  confirm: 'Unsubscribe',
} as const;

export const NOTIFICATIONS_PATH = '/me/notifications';

export function unsubscribeMessage(kind: UnsubscribeKind): string {
  return UNSUBSCRIBE_COPY[kind];
}

export type PrefKey = 'notifyDigest' | 'notifyReminder' | 'notifyEmail' | 'notifyPush';

/** The four toggles, in page order, with their Copy labels. */
export const PREF_ROWS: Array<{ key: PrefKey; label: string }> = [
  { key: 'notifyDigest', label: NOTIFY_COPY.digest },
  { key: 'notifyReminder', label: NOTIFY_COPY.reminder },
  { key: 'notifyEmail', label: NOTIFY_COPY.email },
  { key: 'notifyPush', label: NOTIFY_COPY.push },
];

/** Reads one toggle submission: `key` and `value` ("true" or "false"). Anything else is null. */
export function parsePrefChange(form: FormData): { [K in PrefKey]?: boolean } | null {
  const key = form.get('key');
  const value = form.get('value');
  if (!PREF_ROWS.some(r => r.key === key)) return null;
  if (value !== 'true' && value !== 'false') return null;
  return { [key as PrefKey]: value === 'true' };
}

/** Ten digits starting 6 to 9, as the server wants. Spaces and a +91 or 0 prefix are tolerated. */
export function normalizeWhatsappInput(raw: string): string | null {
  const digits = raw.replace(/[\s-]/g, '').replace(/^(\+91|91|0)(?=\d{10}$)/, '');
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

/** What to tell the user when they add a number: Copy's validation lines, else null. */
export function whatsappError(raw: string, consent: boolean): string | null {
  if (normalizeWhatsappInput(raw) === null) return NOTIFY_COPY.whatsappInvalid;
  if (!consent) return NOTIFY_COPY.whatsappConsentMissing;
  return null;
}
