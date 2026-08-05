import { describe, expect, it } from 'vitest';

import { isNonPlaceVenueName, venueTypeFromName } from './enrich';

describe('venueTypeFromName', () => {
  it('reads the type a name states outright', () => {
    expect(venueTypeFromName('Nayana Auditorium')).toBe('auditorium');
    expect(venueTypeFromName('Sri Siddi Ganapathi Temple')).toBe('temple-hall');
    expect(venueTypeFromName('Anoor Sabhangana')).toBe('sabha-hall');
    expect(venueTypeFromName('Art on the Terrace')).toBe('open-air');
  });

  it('reads Kannada venue vocabulary, not just English', () => {
    expect(venueTypeFromName('A. D. A. Ranga Mandira')).toBe('auditorium');
    expect(venueTypeFromName('Ravindra Kalakshetra')).toBe('auditorium');
    expect(venueTypeFromName('Meenakshi Rangamancha Auditorium.')).toBe('auditorium');
    expect(venueTypeFromName('Purandara Mantapa')).toBe('community-hall');
    expect(venueTypeFromName('Veenesheshanna Bhavana')).toBe('community-hall');
  });

  it('returns nothing when the name does not say what the place is', () => {
    // All three are real venues in the corpus. Their kind is simply not in the string.
    expect(venueTypeFromName('Hamsadhwani')).toBeUndefined();
    expect(venueTypeFromName('Arohy')).toBeUndefined();
    expect(venueTypeFromName('Bhoomiverse')).toBeUndefined();
  });

  it('never guesses "other", which would assert the kind was determined', () => {
    expect(venueTypeFromName('Vinyl & Brew')).toBeUndefined();
  });

  it('matches whole words, so an unrelated name is not dragged in', () => {
    // ` mandali ` must not read as a temple, and ` sangham ` must not read as a sabha.
    expect(venueTypeFromName('Sri Pattabhirama Seva Mandali')).toBeUndefined();
    expect(venueTypeFromName('Mudaliar Sangham Convention Hall')).toBe('community-hall');
  });

  it('prefers the more specific claim when a name stacks two', () => {
    // A pandal is put up on somebody else's grounds, so it must beat the grounds.
    expect(venueTypeFromName('Special Pandal, Old Fort High School Grounds')).toBe('pandal');
    // A named auditorium is an auditorium whatever campus hosts it.
    expect(venueTypeFromName('J.N. Tata Auditorium, IISc')).toBe('auditorium');
    expect(venueTypeFromName('Shashwathi Rangamandira, NMKRV College Campus')).toBe('auditorium');
    // But a lecture theatre is a teaching room, not a concert hall.
    expect(
      venueTypeFromName("Lecture Theatre 1, Golden Jubilee Block, St. John's Medical College")
    ).toBe('university');
    // A hall inside a mutt is a temple hall.
    expect(venueTypeFromName('Kuteera Hall, Sri Yadugiri Yathiraja Mutt')).toBe('temple-hall');
  });

  it('ignores case and punctuation', () => {
    expect(venueTypeFromName('chowdiah memorial hall, Bengaluru')).toBeUndefined();
    expect(venueTypeFromName('SRLKM Concert Hall')).toBe('auditorium');
  });
});

describe('isNonPlaceVenueName', () => {
  it('flags the online meeting rooms that arrived as venues', () => {
    expect(isNonPlaceVenueName('Zoom')).toBe(true);
    expect(isNonPlaceVenueName('Google Meet')).toBe(true);
    expect(isNonPlaceVenueName(' zoom ')).toBe(true);
  });

  it('leaves real halls alone', () => {
    expect(isNonPlaceVenueName('Chowdiah Memorial Hall')).toBe(false);
  });
});
