import { isRouteErrorResponse } from 'react-router';
import { ApplicationError, ErrorCode } from './errors';

export interface ErrorContent {
  title: string;
  message: string;
  /** A missing page: offer the places a reader can go next. A failure: offer Try again. */
  kind: 'missing' | 'failed';
}

const NOT_FOUND_BY_CODE: Partial<Record<ErrorCode, string>> = {
  [ErrorCode.ARTIST_NOT_FOUND]: 'artist',
  [ErrorCode.COMPOSITION_NOT_FOUND]: 'composition',
  [ErrorCode.RAGA_NOT_FOUND]: 'raga',
  [ErrorCode.TALA_NOT_FOUND]: 'tala',
  [ErrorCode.EVENT_NOT_FOUND]: 'concert',
  [ErrorCode.FESTIVAL_NOT_FOUND]: 'festival',
  [ErrorCode.VENUE_NOT_FOUND]: 'venue',
  [ErrorCode.ORGANISER_NOT_FOUND]: 'organiser',
};

const missing = (what: string): ErrorContent => ({
  title: `We could not find this ${what}`,
  message: 'It may have been merged or removed. Try one of the lists below.',
  kind: 'missing',
});

const failed: ErrorContent = {
  title: 'Something went wrong',
  message: 'The problem is on our side. Try again in a moment.',
  kind: 'failed',
};

/**
 * Plain words for the error page. A missing page (404, and the 410 the raga and composition
 * loaders throw for a merged record) reads as "not found", not as a crash. Nothing here shows
 * `error.message`, `statusText` or a status code: those are for the logs, not the reader.
 */
export function errorContent(error: unknown): ErrorContent {
  if (error instanceof ApplicationError) {
    const what = NOT_FOUND_BY_CODE[error.code];
    return what ? missing(what) : failed;
  }
  if (isRouteErrorResponse(error)) {
    return error.status === 404 || error.status === 410 ? missing('page') : failed;
  }
  return failed;
}
