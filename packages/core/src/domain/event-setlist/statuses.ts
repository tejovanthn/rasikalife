/**
 * Here, with no imports, so `client.ts` can export it without importing the entity (and with it
 * ElectroDB and the AWS SDK) into a browser bundle. See `concert-log-item/composition-types.ts`.
 */
export const EVENT_SETLIST_STATUSES = ['derived', 'verified', 'disputed', 'lowConfidence'] as const;
export type EventSetlistStatus = (typeof EVENT_SETLIST_STATUSES)[number];
