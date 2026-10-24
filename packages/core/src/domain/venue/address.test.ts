import { describe, expect, it } from 'vitest';

import { printedVenueAddress, venueAddressSeed } from './address';
import { VenueEntity } from './entity';

// The Odukkathur Mutt poster, as the extractor returns it.
const ODUKKATHUR = {
  street: 'No.13, Gangadhara Chetty Road, Ulsoor',
  city: 'Bengaluru',
  state: 'Karnataka',
  postalCode: '560042',
  country: null,
};

describe('printedVenueAddress', () => {
  it('drops the nulls and blanks a model returns for parts the poster does not state', () => {
    expect(printedVenueAddress({ street: '  ', city: 'Mysuru', state: null })).toEqual({
      city: 'Mysuru',
    });
  });

  it('joins a PIN printed with a space', () => {
    expect(printedVenueAddress({ postalCode: '560 061' })).toEqual({ postalCode: '560061' });
  });

  it('is undefined when nothing is stated', () => {
    expect(printedVenueAddress({ street: null, city: '' })).toBeUndefined();
    expect(printedVenueAddress(null)).toBeUndefined();
  });
});

describe('venueAddressSeed', () => {
  it('copies the whole printed address onto a venue that has none', () => {
    expect(venueAddressSeed({}, ODUKKATHUR)).toEqual({
      address: {
        street: 'No.13, Gangadhara Chetty Road, Ulsoor',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560042',
      },
      city: 'Bengaluru',
    });
  });

  it('never touches a venue that already holds any part of an address', () => {
    // A street from one poster beside a PIN from another is an address nobody wrote.
    expect(venueAddressSeed({ address: { postalCode: '560004' } }, ODUKKATHUR)).toBeUndefined();
  });

  it('seeds nothing when the poster and the record disagree about the city', () => {
    // A Chennai concert linked to the Bengaluru Hamsadhwani: the link is wrong, not the hall.
    expect(
      venueAddressSeed({ city: 'Bengaluru' }, { street: 'Mylapore', city: 'Chennai' })
    ).toBeUndefined();
  });

  it('seeds nothing when the printed city contradicts the printed PIN', () => {
    expect(venueAddressSeed({}, { city: 'Mysuru', postalCode: '560042' })).toBeUndefined();
  });

  it('treats Bangalore and Bengaluru as one city and keeps the spelling already in use', () => {
    const seed = venueAddressSeed(
      { city: 'Bengaluru' },
      { street: 'Vasanthapura', city: 'Bangalore', postalCode: '560061' }
    );
    expect(seed?.address.city).toBe('Bengaluru');
    // The venue had a city, so the top-level field is left alone.
    expect(seed?.city).toBeUndefined();
  });

  it("takes the PIN's city when the poster names none", () => {
    expect(venueAddressSeed({}, { street: 'Basavanagudi', postalCode: '560 004' })).toEqual({
      address: { street: 'Basavanagudi', city: 'Bengaluru', postalCode: '560004' },
      city: 'Bengaluru',
    });
  });

  it('seeds nothing from a state alone, since that places nothing', () => {
    expect(venueAddressSeed({}, { state: 'Karnataka', country: 'India' })).toBeUndefined();
  });

  it('keeps a city outside the PIN table as printed', () => {
    expect(venueAddressSeed({}, { city: 'Udupi' })).toEqual({
      address: { city: 'Udupi' },
      city: 'Udupi',
    });
  });
});

describe('the patch the approval cascade writes', () => {
  // Read off the real entity's `.params()`: `city` keys the `byCity` index, and a mocked entity
  // would agree with whatever the cascade claims to write (CLAUDE.md rule 7).
  it('moves the venue onto its city page, leaving the stored sort key alone', () => {
    const seed = venueAddressSeed({}, ODUKKATHUR);
    if (!seed) throw new Error('expected a seed');
    const params = VenueEntity.patch({ id: 'v1' }).set(seed).params() as {
      ExpressionAttributeValues: Record<string, unknown>;
      ConditionExpression: string;
    };

    expect(params.ExpressionAttributeValues[':gsi3pk_u0']).toBe('venue_city#bengaluru');
    // The sort key is built from `name` and `id`, which every venue holds from creation.
    expect(Object.keys(params.ExpressionAttributeValues)).not.toContain(':gsi3sk_u0');
    // `patch` carries an existence condition, so a venue deleted mid-approval is not recreated.
    expect(params.ConditionExpression).toContain('attribute_exists');
  });
});
