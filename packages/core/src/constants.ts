// packages/core/src/constants.ts
export enum ErrorCode {
  // Entity not found errors
  ARTIST_NOT_FOUND = 'ARTIST_NOT_FOUND',
  COMPOSITION_NOT_FOUND = 'COMPOSITION_NOT_FOUND',
  RAGA_NOT_FOUND = 'RAGA_NOT_FOUND',
  TALA_NOT_FOUND = 'TALA_NOT_FOUND',

  // Operation failures
  ARTIST_FETCH_FAILED = 'ARTIST_FETCH_FAILED',
  ARTIST_CREATE_FAILED = 'ARTIST_CREATE_FAILED',
  ARTIST_UPDATE_FAILED = 'ARTIST_UPDATE_FAILED',

  // Validation and data errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
}

export class ApplicationError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'ApplicationError';
  }
}
