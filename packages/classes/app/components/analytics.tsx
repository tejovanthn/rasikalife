import { useEffect } from 'react';
import { useLocation } from 'react-router';

const MEASUREMENT_ID = 'G-ZL00N9T3C6';

declare global {
  interface Window {
    dataLayer: unknown[];
  }
}

// gtag.js reads `arguments` objects off the data layer, so a plain array would be ignored.
function gtag(..._args: unknown[]) {
  window.dataLayer = window.dataLayer || [];
  // biome-ignore lint/style/noArguments: gtag.js needs the arguments object itself.
  window.dataLayer.push(arguments);
}

/**
 * GA4 for Rasika Classes, through the plain gtag loader.
 *
 * Prod only, and never for a driven browser (`navigator.webdriver`), for the reason
 * `packages/web/app/firebase.ts` gives. Page views are sent by hand on each route change,
 * because the app is a single page after the first load and gtag would see only the first.
 */
export function Analytics() {
  const location = useLocation();

  useEffect(() => {
    if (import.meta.env.VITE_STAGE !== 'prod' || navigator.webdriver === true) {
      return;
    }
    if (document.getElementById('ga4')) {
      return;
    }
    gtag('js', new Date());
    gtag('config', MEASUREMENT_ID, { send_page_view: false });
    const script = document.createElement('script');
    script.id = 'ga4';
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
    document.head.appendChild(script);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: the path is the trigger, not an input.
  useEffect(() => {
    if (!document.getElementById('ga4')) {
      return;
    }
    gtag('event', 'page_view', { send_to: MEASUREMENT_ID });
  }, [location.pathname, location.search]);

  return null;
}
