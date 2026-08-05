import { describe, expect, it } from 'vitest';

import { resolveEventContact } from './event-contact';

describe('resolveEventContact', () => {
  const organiser = {
    phone: '+919845514661',
    email: 'info@vanamalaarts.org',
    website: 'https://vanamalaarts.org',
  };

  it('prefers what the poster printed for this concert', () => {
    expect(resolveEventContact({ phone: '9448079079' }, organiser)).toEqual({
      phone: '9448079079',
      source: 'event',
    });
  });

  it('does not top up the event’s details from the organiser', () => {
    // Whole-block or nothing: a phone off this poster beside a website off the organiser's
    // record is one list the reader cannot take apart.
    const resolved = resolveEventContact({ phone: '9448079079' }, organiser);
    expect(resolved?.website).toBeUndefined();
    expect(resolved?.email).toBeUndefined();
  });

  it('borrows the organiser’s when the poster stated none', () => {
    expect(resolveEventContact(undefined, organiser)).toEqual({
      ...organiser,
      source: 'organiser',
    });
  });

  it('borrows when the event carries an empty or blank block', () => {
    expect(resolveEventContact({}, organiser)?.source).toBe('organiser');
    expect(resolveEventContact({ phone: '   ', email: '' }, organiser)?.source).toBe('organiser');
  });

  it('returns nothing when neither side knows anything', () => {
    expect(resolveEventContact(undefined, undefined)).toBeUndefined();
    expect(resolveEventContact({}, {})).toBeUndefined();
    expect(resolveEventContact(null, null)).toBeUndefined();
  });

  it('trims the values it returns', () => {
    expect(resolveEventContact({ email: '  a@b.c  ' }, undefined)).toEqual({
      email: 'a@b.c',
      source: 'event',
    });
  });

  it('ignores an organiser that knows nothing, rather than reporting an empty block', () => {
    expect(resolveEventContact(undefined, { phone: '  ' })).toBeUndefined();
  });
});
