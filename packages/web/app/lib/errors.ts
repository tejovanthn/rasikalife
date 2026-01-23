// Error codes for web package - mirrors @rasika/core to avoid Node.js dependencies
export enum ErrorCode {
  ARTIST_NOT_FOUND = 'ARTIST_NOT_FOUND',
  COMPOSITION_NOT_FOUND = 'COMPOSITION_NOT_FOUND',
  RAGA_NOT_FOUND = 'RAGA_NOT_FOUND',
  TALA_NOT_FOUND = 'TALA_NOT_FOUND',
  ARTIST_FETCH_FAILED = 'ARTIST_FETCH_FAILED',
  ARTIST_CREATE_FAILED = 'ARTIST_CREATE_FAILED',
  ARTIST_UPDATE_FAILED = 'ARTIST_UPDATE_FAILED',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  SEARCH_INDEX_ERROR = 'SEARCH_INDEX_ERROR',
  SEARCH_INDEX_BUILD_FAILED = 'SEARCH_INDEX_BUILD_FAILED',
  SEARCH_QUERY_FAILED = 'SEARCH_QUERY_FAILED',
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
