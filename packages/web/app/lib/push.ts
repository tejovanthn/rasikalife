/**
 * Web push in the browser. The pure parts live here and are tested; `push-client.ts` holds the
 * calls that touch `navigator`. Strings are from `copy.md` ("Confirmation, push, concert book,
 * WhatsApp").
 */

export const PUSH_COPY = {
  button: 'Remind me the day before',
  helper: "We'll send a notification the evening before their concerts.",
  enabled: 'Reminders are on for this device.',
  blocked: 'Notifications are blocked for rasika.life. Turn them on in your browser settings.',
  iosInstall:
    'On iPhone, add rasika.life to your Home Screen first: tap Share, then Add to Home Screen.',
} as const;

/** iPhone, iPod, iPad. iPadOS 13+ reports a Mac user agent, so a touch screen gives it away. */
export function isIos(userAgent: string, maxTouchPoints = 0): boolean {
  if (/iPhone|iPad|iPod/.test(userAgent)) return true;
  return /Macintosh/.test(userAgent) && maxTouchPoints > 1;
}

/**
 * iOS gives web push only to a site added to the Home Screen. In Safari that is not the case
 * until the reader installs it; `navigator.standalone` (or the display-mode media query) is true
 * once it runs from the Home Screen icon.
 */
export function isIosNotInstalled(input: {
  userAgent: string;
  maxTouchPoints?: number;
  standalone: boolean;
}): boolean {
  return isIos(input.userAgent, input.maxTouchPoints ?? 0) && !input.standalone;
}

export type PushUiState =
  /** Hide the button: no VAPID key, or the browser has no push. */
  | 'unsupported'
  /** Show the iOS "add to Home Screen" helper instead of a button. */
  | 'ios-install'
  | 'blocked'
  /** Show the button. */
  | 'available'
  /** This device is subscribed. */
  | 'enabled';

export function pushUiState(input: {
  hasVapidKey: boolean;
  userAgent: string;
  maxTouchPoints?: number;
  standalone: boolean;
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  hasNotification: boolean;
  permission: NotificationPermission | 'unsupported';
  subscribed: boolean;
}): PushUiState {
  if (!input.hasVapidKey) return 'unsupported';
  // On iOS the push APIs do not exist until the site is installed, so check this first.
  if (isIosNotInstalled(input)) return 'ios-install';
  if (!input.hasServiceWorker || !input.hasPushManager || !input.hasNotification) {
    return 'unsupported';
  }
  if (input.permission === 'denied') return 'blocked';
  if (input.permission === 'granted' && input.subscribed) return 'enabled';
  return 'available';
}

/** VAPID public keys travel as URL-safe base64; `subscribe` wants bytes. */
export function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/** `PushSubscription.toJSON()` to the tRPC input, or null when a key is missing. */
export function toSubscriptionInput(json: {
  endpoint?: string;
  keys?: Record<string, string>;
}): PushSubscriptionInput | null {
  const { endpoint, keys } = json;
  if (!endpoint || !keys?.p256dh || !keys.auth) return null;
  return { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } };
}

/** Reads the form a push button posts: `endpoint`, `p256dh`, `auth`. Null when anything is empty. */
export function parseSubscriptionForm(form: FormData): PushSubscriptionInput | null {
  const endpoint = form.get('endpoint');
  const p256dh = form.get('p256dh');
  const auth = form.get('auth');
  if (typeof endpoint !== 'string' || typeof p256dh !== 'string' || typeof auth !== 'string') {
    return null;
  }
  return toSubscriptionInput({ endpoint, keys: { p256dh, auth } });
}
