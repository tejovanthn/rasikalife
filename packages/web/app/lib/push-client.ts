/**
 * The browser calls behind the push button. Call these from a click handler only: asking for
 * permission on page load is refused by some browsers and is rude in all of them.
 */
import { pushUiState, toSubscriptionInput, urlBase64ToUint8Array } from './push';
import type { PushSubscriptionInput, PushUiState } from './push';

function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches;
}

async function currentSubscription(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch {
    return null;
  }
}

/** What to show for this device, read after mount (the server cannot know). */
export async function readPushState(vapidKey: string | null): Promise<PushUiState> {
  const hasPushManager = 'PushManager' in window;
  const hasNotification = 'Notification' in window;
  const subscribed = hasPushManager ? Boolean(await currentSubscription()) : false;
  return pushUiState({
    hasVapidKey: Boolean(vapidKey),
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
    standalone: isStandalone(),
    hasServiceWorker: 'serviceWorker' in navigator,
    hasPushManager,
    hasNotification,
    permission: hasNotification ? Notification.permission : 'unsupported',
    subscribed,
  });
}

export type EnableResult =
  | { ok: true; subscription: PushSubscriptionInput }
  | { ok: false; reason: 'denied' | 'error' };

/** Asks permission, subscribes this browser, and returns what the server must store. */
export async function enablePush(vapidKey: string): Promise<EnableResult> {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return { ok: false, reason: 'denied' };
    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
      }));
    const input = toSubscriptionInput(subscription.toJSON());
    return input ? { ok: true, subscription: input } : { ok: false, reason: 'error' };
  } catch (error) {
    console.error('Could not enable push:', error);
    return { ok: false, reason: 'error' };
  }
}

/** Unsubscribes this browser and returns its endpoint for the server, or null if it had none. */
export async function disablePush(): Promise<string | null> {
  const subscription = await currentSubscription();
  if (!subscription) return null;
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe().catch(() => false);
  return endpoint;
}
