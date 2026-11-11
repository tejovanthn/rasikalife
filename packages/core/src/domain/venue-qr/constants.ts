export const QR_CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base32, no I L O U
export const QR_CODE_LENGTH = 8;
export const QR_BASE_URL = 'https://rasika.life/q/';
export const QR_BATCH_MAX = 200;
export const QR_BULK_ASSIGN_MAX = 50;
export const QR_FORMATS = ['sticker', 'table-tent', 'poster'] as const;

export const LIVE_WINDOW_BEFORE_MIN = 90;
export const LIVE_WINDOW_AFTER_MIN = 30;
export const DEFAULT_EVENT_DURATION_MIN = 180;
export const VENUE_MODE_UPCOMING_LIMIT = 3;
export const SCAN_RATE_LIMIT_PER_MIN = 60;

export const QR_INTENT_COOKIE = 'qr_intent';
export const QR_INTENT_TTL_SEC = 15 * 60;

export const DIGEST_WINDOW_DAYS = 14;
export const DIGEST_MAX_EVENTS = 15;
export const REMINDER_MAX_PER_DAY = 3; // RSVPed events sit outside this cap
export const REASON_WEIGHTS = { rsvp: 10, artist: 3, organiser: 2, venue: 1 } as const;

export const CONSENT_VERSIONS = { share: 'share-v1', whatsapp: 'whatsapp-v1' } as const;
export const PRESIGNED_URL_TTL_SEC = 300;
export const PARTNER_INVITE_TTL_DAYS = 14;
export const DEFAULT_TIMEZONE = 'Asia/Kolkata';
