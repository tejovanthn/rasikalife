import { useEffect, useState } from 'react';

/**
 * Registers the service worker, and shows an honest offline state.
 *
 * There are no offline writes (see `public/sw.js` for why), so the only useful thing to do when
 * the network drops is say so. A banner that stays out of the way but is impossible to miss
 * beats a "mark attended" button that appears to work and silently does not.
 */
export function RegisterServiceWorker() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(error => {
        // A failed registration costs the install prompt and nothing else, so it must not take
        // the page down with it.
        console.error('[classes] service worker registration failed:', error);
      });
    }

    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  if (!offline) {
    return null;
  }

  return (
    // `top-14` alone put the banner under a 3.5rem header — but the header is 3.5rem *plus*
    // `env(safe-area-inset-top)`, so in standalone mode on a notched phone the banner slid
    // beneath it by the inset.
    <output className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 block border-b border-warning bg-warning px-4 py-2 text-center text-sm text-warning-foreground">
      You are offline. Nothing can be marked or confirmed until you reconnect.
    </output>
  );
}
