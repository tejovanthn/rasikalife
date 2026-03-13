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

// Initialize Analytics conditionally
export const analytics = isSupported().then(yes => {
  if (yes && import.meta.env.STAGE === 'prod') {
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
