import { describe, expect, it } from 'vitest';
import { ApplicationError, ErrorCode } from './errors';

describe('ApplicationError', () => {
  it('carries a code, message, and name', () => {
    const error = new ApplicationError(ErrorCode.ARTIST_NOT_FOUND, 'Artist not found');

    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe('ARTIST_NOT_FOUND');
    expect(error.message).toBe('Artist not found');
    expect(error.name).toBe('ApplicationError');
  });

  it('optionally carries a cause', () => {
    const cause = new Error('root cause');
    const error = new ApplicationError(ErrorCode.DATABASE_ERROR, 'DB failed', cause);

    expect(error.cause).toBe(cause);
  });

  it('leaves cause undefined when not provided', () => {
    const error = new ApplicationError(ErrorCode.VALIDATION_ERROR, 'Invalid input');

    expect(error.cause).toBeUndefined();
  });
});
