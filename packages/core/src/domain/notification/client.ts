/**
 * Client-safe exports for the notification domain. No Node.js or AWS imports.
 */
export const UNSUBSCRIBE_KINDS = ['digest', 'reminders', 'all'] as const;
export type UnsubscribeKind = (typeof UNSUBSCRIBE_KINDS)[number];
