import { describe, expect, it } from 'vitest';
import { ApplicationError } from '../constants';
import { createFailedError, notFoundError, updateFailedError } from './helpers';

describe('notFoundError', () => {
  it('builds an ApplicationError with an upper-cased entity-prefixed code', () => {
    const error = notFoundError('artist', 'artist-1');

    expect(error).toBeInstanceOf(ApplicationError);
    expect(error.code).toBe('ARTIST_NOT_FOUND');
    expect(error.message).toBe('artist with ID artist-1 not found');
  });
});

describe('createFailedError', () => {
  it('builds an ApplicationError referencing the attempted name', () => {
    const error = createFailedError('award', 'Sangita Kalanidhi');

    expect(error.code).toBe('AWARD_CREATE_FAILED');
    expect(error.message).toBe('Failed to create award: Sangita Kalanidhi');
  });
});

describe('updateFailedError', () => {
  it('builds an ApplicationError referencing the entity id', () => {
    const error = updateFailedError('venue', 'venue-1');

    expect(error.code).toBe('VENUE_UPDATE_FAILED');
    expect(error.message).toBe('venue with ID venue-1 update failed');
  });
});
