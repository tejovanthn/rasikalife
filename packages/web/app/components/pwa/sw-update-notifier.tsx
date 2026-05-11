import { useEffect } from 'react';
import { toast } from 'sonner';

interface SwUpdateEvent extends Event {
  detail: { registration: ServiceWorkerRegistration };
}

export function SwUpdateNotifier() {
  useEffect(() => {
    const handler = (e: Event) => {
      const { registration } = (e as SwUpdateEvent).detail;
      toast('Update available', {
        description: 'A new version of Rasika is ready.',
        duration: Number.POSITIVE_INFINITY,
        action: {
          label: 'Reload',
          onClick: () => {
            registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
            window.location.reload();
          },
        },
      });
    };
    window.addEventListener('sw-update-waiting', handler);
    return () => window.removeEventListener('sw-update-waiting', handler);
  }, []);

  return null;
}
