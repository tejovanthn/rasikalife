// Import the functions you need from the SDKs you need
import { getAnalytics, isSupported, logEvent } from 'firebase/analytics';
import { initializeApp } from 'firebase/app';

const firebaseConfig = {
  apiKey: 'AIzaSyCWdgsxaHFtIIi85lCRbzVPGpm68FpS0Y8',
  authDomain: 'rasika-life.firebaseapp.com',
  projectId: 'rasika-life',
  storageBucket: 'rasika-life.appspot.com',
  messagingSenderId: '592955931767',
  appId: '1:592955931767:web:46f2c1a30e1f6fca251a72',
  measurementId: 'G-S3X2LKMFQB',
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

// Initialize Analytics conditionally
export const analytics = isSupported().then((yes) =>
  yes ? getAnalytics(app) : null,
);

export const logAnalyticsEvent = (
  event: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: Record<string, any>,
) => {
  analytics.then((analyticsInstance) => {
    if (analyticsInstance) {
      logEvent(analyticsInstance, event, params);
    }
  });
};
