import { logAnalyticsEvent } from '~/firebase';

/**
 * The events worth counting, in one place.
 *
 * Until now the property recorded only `page_view`, `session_start`, `first_visit`
 * and `web_vitals`, so nothing could answer whether anyone submitted an event,
 * claimed a profile or followed a link into Rasika Classes. Pageviews measure
 * arrival; these measure whether arriving was any use.
 *
 * Names are snake_case to match the GA4 convention, and each one is a completed
 * act rather than a click where that distinction is available — `event_submitted`
 * fires when the event exists, not when the button is pressed.
 *
 * Mark the ones that matter as key events in the GA4 console; the SDK cannot do
 * that from here.
 */
export const AnalyticsEvent = {
  /** A poster was uploaded and the extraction step began. */
  EVENT_SUBMIT_STARTED: 'event_submit_started',
  /** Events were created and the contributor reached the verify step. */
  EVENT_SUBMITTED: 'event_submitted',
  /** A contributor confirmed the extracted events. */
  EVENT_PUBLISHED: 'event_published',
  /** Someone followed a CTA out to classes.rasika.life. Cross-domain, so GA4
   *  cannot attribute this on its own. */
  CLASSES_CTA_CLICK: 'classes_cta_click',
  /** A wiki edit was proposed. */
  EDIT_SUBMITTED: 'edit_submitted',
  /** A search was run and returned. */
  SEARCH_PERFORMED: 'search_performed',
  /** Sign-in was started — the redirect to the provider. */
  SIGN_IN_STARTED: 'sign_in_started',
} as const;

export type AnalyticsEventName = (typeof AnalyticsEvent)[keyof typeof AnalyticsEvent];

export function trackEvent(name: AnalyticsEventName, params: Record<string, unknown> = {}): void {
  logAnalyticsEvent(name, params);
}
