/**
 * Validation message templates for Zod schemas
 */

export const ValidationMessage = {
  // Common validation messages
  REQUIRED: 'This field is required',
  STRING_MIN: (min: number) => `Must be at least ${min} characters`,
  STRING_MAX: (max: number) => `Must be at most ${max} characters`,
  EMAIL_INVALID: 'Invalid email address',
  DATE_INVALID: 'Invalid date format',
  ENUM_INVALID: 'Invalid option selected',
  NUMBER_MIN: (min: number) => `Must be at least ${min}`,
  NUMBER_MAX: (max: number) => `Must be at most ${max}`,
  
  // User domain validation
  USERNAME_FORMAT: 'Username must contain only letters, numbers, and underscores',
  USERNAME_LENGTH: 'Username must be between 3 and 30 characters',
  PASSWORD_STRENGTH: 'Password must include at least 8 characters with a mix of letters, numbers, and symbols',
  DISPLAY_NAME_LENGTH: 'Display name must be between 2 and 50 characters',
  BIO_LENGTH: 'Bio must be at most 500 characters',
  
  // Artist domain validation
  ARTIST_NAME_REQUIRED: 'Artist name is required',
  ARTIST_TYPE_INVALID: 'Invalid artist type',
  INSTRUMENTS_EMPTY: 'At least one instrument is required',
  
  // Composition domain validation
  TITLE_REQUIRED: 'Title is required',
  COMPOSER_REQUIRED: 'Composer is required',
  RAGAS_EMPTY: 'At least one raga is required',
  TALAS_EMPTY: 'At least one tala is required',
  LANGUAGE_REQUIRED: 'Language is required',
  
  // Raga domain validation
  RAGA_NAME_REQUIRED: 'Raga name is required',
  AROHANAM_FORMAT: 'Invalid arohanam format',
  AVAROHANAM_FORMAT: 'Invalid avarohanam format',
  
  // Tala domain validation
  TALA_NAME_REQUIRED: 'Tala name is required',
  AKSHARAS_RANGE: 'Aksharas must be a positive integer',
  
  // Event domain validation
  EVENT_TITLE_REQUIRED: 'Event title is required',
  START_DATE_REQUIRED: 'Start date is required',
  END_DATE_REQUIRED: 'End date is required',
  DATE_RANGE_INVALID: 'End date must be after start date',
  EVENT_TYPE_INVALID: 'Invalid event type',
  ARTISTS_EMPTY: 'At least one artist is required',
  
  // Venue domain validation
  VENUE_NAME_REQUIRED: 'Venue name is required',
  COUNTRY_REQUIRED: 'Country is required',
  
  // Forum domain validation
  THREAD_TITLE_REQUIRED: 'Thread title is required',
  THREAD_CONTENT_REQUIRED: 'Thread content is required',
  REPLY_CONTENT_REQUIRED: 'Reply content is required',
  
  // Collection domain validation
  COLLECTION_TITLE_REQUIRED: 'Collection title is required',
  
  // Payment domain validation
  AMOUNT_POSITIVE: 'Amount must be positive',
  CURRENCY_INVALID: 'Invalid currency code'
} as const;