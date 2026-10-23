import { describe, expect, it } from 'vitest';
import { cityForPin, parseMapLinkCoordinates, planVenueGeo, venuePostalCode } from './geo';

const RESOLVED =
  'https://www.google.com/maps/place/A.+D.+A.+Ranga+Mandira/@12.960848,77.5817633,17z/data=!4m6!3m5!1s0x3bae15e0bccf2c79:0x6cbde25087d0dd48!8m2!3d12.9622441!4d77.5843681!16s';

describe('parseMapLinkCoordinates', () => {
  it("prefers the place's pin to the map centre", () => {
    expect(parseMapLinkCoordinates(RESOLVED)).toEqual({ lat: 12.9622441, lng: 77.5843681 });
  });

  it('falls back to the centre, then to a query', () => {
    expect(parseMapLinkCoordinates('https://www.google.com/maps/@13.0011,77.5725,15z')).toEqual({
      lat: 13.0011,
      lng: 77.5725,
    });
    expect(
      parseMapLinkCoordinates('https://www.google.com/maps/dir/?api=1&destination=12.9925,77.57')
    ).toEqual({ lat: 12.9925, lng: 77.57 });
  });

  it('reads nothing from a short link or an address query', () => {
    expect(parseMapLinkCoordinates('https://maps.app.goo.gl/cm2QYj3sHNmiC73K7')).toBeNull();
    expect(
      parseMapLinkCoordinates('https://maps.google.com/maps?q=7%2C+4th+Main+Road%2C+Domlur+560071')
    ).toBeNull();
  });
});

describe('venuePostalCode', () => {
  it('reads the field, then a PIN in the street line', () => {
    expect(venuePostalCode({ postalCode: '560 004' })).toBe('560004');
    expect(venuePostalCode({ street: '16th Cross, Malleswaram, Bangalore 560003' })).toBe('560003');
    expect(venuePostalCode({ street: '7, 4th Main Road' })).toBeUndefined();
  });
});

describe('cityForPin', () => {
  it('names only the ranges the table covers', () => {
    expect(cityForPin('560003')).toBe('Bengaluru');
    expect(cityForPin('600004')).toBe('Chennai');
    expect(cityForPin('411001')).toBeUndefined();
  });
});

describe('planVenueGeo', () => {
  const pins = { '560003': [13.0011, 77.5725] as const };

  it('takes the map link before the PIN centroid', () => {
    expect(
      planVenueGeo(
        { mapLink: 'https://maps.app.goo.gl/x', address: { postalCode: '560003' } },
        pins,
        RESOLVED
      )
    ).toMatchObject({ lat: 12.9622441, lng: 77.5843681, geoSource: 'map-link' });
  });

  it('falls back to the centroid and fills the city and PIN it proves', () => {
    expect(planVenueGeo({ address: { street: 'Vyalikaval, Bangalore 560003' } }, pins)).toEqual({
      lat: 13.0011,
      lng: 77.5725,
      geoSource: 'postal-code',
      address: { street: 'Vyalikaval, Bangalore 560003', postalCode: '560003', city: 'Bengaluru' },
    });
  });

  it('never touches what is already stored', () => {
    expect(
      planVenueGeo(
        { lat: 1, lng: 2, city: 'Bangalore', address: { postalCode: '560003' } },
        pins,
        RESOLVED
      )
    ).toEqual({});
  });

  it('places nothing when the stated city and the PIN disagree', () => {
    expect(planVenueGeo({ address: { city: 'Chennai', postalCode: '560003' } }, pins)).toEqual({});
    // "Bangalore" is Bengaluru, so that one agrees.
    expect(
      planVenueGeo({ city: 'Bangalore', address: { postalCode: '560003' } }, pins)
    ).toMatchObject({ geoSource: 'postal-code' });
  });

  it('fills nothing it cannot prove', () => {
    expect(planVenueGeo({ address: { postalCode: '411001' } }, pins)).toEqual({});
  });
});
