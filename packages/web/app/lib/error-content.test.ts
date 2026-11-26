import { describe, expect, it } from 'vitest';
import { errorContent } from './error-content';
import { ApplicationError, ErrorCode } from './errors';

// The shape React Router puts in `useRouteError()` for a thrown `Response`.
const routeError = (status: number, statusText: string) => ({
  status,
  statusText,
  internal: false,
  data: statusText,
});

describe('errorContent', () => {
  it('reads 404 and 410 as a missing page, not a crash', () => {
    for (const status of [404, 410]) {
      const content = errorContent(routeError(status, 'Gone'));
      expect(content.kind).toBe('missing');
      expect(content.title).toBe('We could not find this page');
    }
  });

  it('reads other statuses as a failure on our side', () => {
    expect(errorContent(routeError(500, 'Failed to load raga')).kind).toBe('failed');
  });

  it('names what is missing for a not-found ApplicationError', () => {
    const content = errorContent(new ApplicationError(ErrorCode.RAGA_NOT_FOUND, 'raw db text'));
    expect(content.kind).toBe('missing');
    expect(content.title).toBe('We could not find this raga');
  });

  it('never shows a raw message, status text or status code', () => {
    const cases = [
      routeError(410, 'Gone'),
      routeError(500, 'Failed to load raga'),
      new ApplicationError(ErrorCode.DATABASE_ERROR, 'ConditionalCheckFailedException'),
      new Error('ECONNRESET at db.ts:12'),
      'boom',
    ];
    for (const error of cases) {
      const { title, message } = errorContent(error);
      const text = `${title} ${message}`;
      expect(text).not.toMatch(/ECONNRESET|Conditional|boom|db\.ts|Gone|Failed to load|\d{3}/);
    }
  });
});
