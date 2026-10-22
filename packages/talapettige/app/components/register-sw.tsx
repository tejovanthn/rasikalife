import { useEffect } from 'react';

/**
 * Registers the service worker that makes the app work offline (`public/sw.js`).
 *
 * Skipped in dev: `react-router dev` serves unhashed modules, and a worker caching those would
 * keep serving stale code across edits.
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (import.meta.env.DEV || !('serviceWorker' in navigator)) {
      return;
    }
    navigator.serviceWorker.register('/sw.js').catch(error => {
      // A failed registration costs offline use and the install prompt, nothing else.
      console.error('[talapettige] service worker registration failed:', error);
    });
  }, []);

  return null;
}
