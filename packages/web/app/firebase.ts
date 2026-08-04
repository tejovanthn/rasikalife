// Import the functions you need from the SDKs you need
import { getAnalytics, isSupported, logEvent } from 'firebase/analytics';
import { initializeApp } from 'firebase/app';
import { onCLS, onFCP, onLCP, onTTFB } from 'web-vitals';

const firebaseConfig = {
  apiKey: 'AIzaSyBMTvQChxd0-1o4zjEyy1pbjUQhavFTwWQ',
  authDomain: 'rasikalife.firebaseapp.com',
  projectId: 'rasikalife',
  storageBucket: 'rasikalife.firebasestorage.app',
  messagingSenderId: '297629448178',
  appId: '1:297629448178:web:d25e205c2b54e908fc5d6b',
  measurementId: 'G-6TV9YL9JC6',
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

/**
 * A driven browser is not a visitor.
 *
 * Something walked 2,882 distinct pages in a month as desktop Chrome, one visit
 * each, averaging 1.2 seconds — four fifths of all recorded sessions, which made
 * every engagement number on the property meaningless. GA4's own bot exclusion
 * did not catch it because it renders and runs scripts like a real browser.
 *
 * `navigator.webdriver` is set by Puppeteer, Playwright and Selenium, so this
 * catches the automated-Chrome case without touching real traffic. It is not a
 * complete defence — a crawler that spoofs the flag still counts — so the GA4
 * data filter stays worth having.
 */
function isAutomatedBrowser(): boolean {
  return typeof navigator !== 'undefined' && navigator.webdriver === true;
}

// Initialize Analytics conditionally
export const analytics = isSupported().then(yes => {
  if (yes && import.meta.env.VITE_STAGE === 'prod' && !isAutomatedBrowser()) {
    const analyticsInstance = getAnalytics(app);

    // Track Core Web Vitals
    onCLS(metric =>
      logEvent(analyticsInstance, 'web_vitals', {
        name: 'CLS',
        value: Math.round(metric.value * 1000), // CLS is reported as decimal
        event_label: metric.id,
        non_interaction: true,
      })
    );

    onFCP(metric =>
      logEvent(analyticsInstance, 'web_vitals', {
        name: 'FCP',
        value: Math.round(metric.value),
        event_label: metric.id,
        non_interaction: true,
      })
    );

    onLCP(metric =>
      logEvent(analyticsInstance, 'web_vitals', {
        name: 'LCP',
        value: Math.round(metric.value),
        event_label: metric.id,
        non_interaction: true,
      })
    );

    onTTFB(metric =>
      logEvent(analyticsInstance, 'web_vitals', {
        name: 'TTFB',
        value: Math.round(metric.value),
        event_label: metric.id,
        non_interaction: true,
      })
    );

    return analyticsInstance;
  }
  return null;
});

export const logAnalyticsEvent = (event: string, params: Record<string, unknown>) => {
  analytics.then(analyticsInstance => {
    if (analyticsInstance) {
      logEvent(analyticsInstance, event, params);
    }
  });
};
