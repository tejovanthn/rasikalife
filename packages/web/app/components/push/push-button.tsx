import { useEffect, useState } from 'react';
import { useFetcher } from 'react-router';
import { PUSH_COPY } from '~/lib/push';
import { enablePush } from '~/lib/push-client';
import { QR_COPY } from '~/lib/qr-scan';
import { usePushState } from './use-push-state';

const button =
  'flex min-h-14 w-full items-center justify-center rounded-xl bg-primary px-6 text-xl font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60';

/**
 * "Remind me the day before", on the confirmation screen. A button only: permission is asked on
 * the tap, never on page load. The enclosing route's action takes `intent=push` and calls
 * `notify.subscribePush`. Renders nothing where push cannot work (no key, no browser support).
 */
export function PushButton({ vapidKey }: { vapidKey: string | null }) {
  const [state, setState] = usePushState(vapidKey);
  const fetcher = useFetcher<{ ok: boolean }>();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data && !fetcher.data.ok) {
      setFailed(true);
      setState('available');
    }
  }, [fetcher.state, fetcher.data, setState]);

  if (!state || state === 'unsupported') return null;
  if (state === 'ios-install') return <p>{PUSH_COPY.iosInstall}</p>;
  if (state === 'blocked') return <p>{PUSH_COPY.blocked}</p>;
  if (state === 'enabled') return <p className="font-medium">{PUSH_COPY.enabled}</p>;

  const onClick = async () => {
    if (!vapidKey) return;
    setBusy(true);
    setFailed(false);
    const result = await enablePush(vapidKey);
    setBusy(false);
    if (!result.ok) {
      if (result.reason === 'denied') setState('blocked');
      else setFailed(true);
      return;
    }
    setState('enabled');
    fetcher.submit(
      {
        intent: 'push',
        endpoint: result.subscription.endpoint,
        p256dh: result.subscription.keys.p256dh,
        auth: result.subscription.keys.auth,
      },
      { method: 'post' }
    );
  };

  return (
    <div className="space-y-2">
      <button type="button" className={button} disabled={busy} onClick={onClick}>
        {PUSH_COPY.button}
      </button>
      <p className="text-base">{PUSH_COPY.helper}</p>
      {failed && (
        <p role="alert" className="text-destructive">
          {QR_COPY.error.body}
        </p>
      )}
    </div>
  );
}
