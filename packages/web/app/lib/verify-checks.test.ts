import { describe, expect, it } from 'vitest';
import { fieldsToCheck } from './verify-checks';

const now = new Date('2026-10-24T00:00:00Z');
const good = {
  title: 'Vocal concert',
  startDateTime: '2026-11-01T18:00:00+05:30',
  venue: { name: 'Gayana Samaja', id: 'v1' },
  organiser: { name: 'Gayana Samaja', id: 'o1' },
  artists: [{ name: 'Savita Vasu', id: 'a1' }],
  extractionConfidence: 0.9,
};

describe('fieldsToCheck', () => {
  it('asks nothing of a draft where everything matched', () => {
    expect(fieldsToCheck(good, now)).toEqual([]);
  });

  it('flags a poster the model found hard to read', () => {
    expect(fieldsToCheck({ ...good, extractionConfidence: 0.4 }, now)[0]).toMatch(/hard to read/);
  });

  it('says nothing about confidence when none was stored', () => {
    expect(fieldsToCheck({ ...good, extractionConfidence: undefined }, now)).toEqual([]);
  });

  it('flags a date in the past, the sign of a guessed year', () => {
    expect(fieldsToCheck({ ...good, startDateTime: '2024-11-01T18:00:00+05:30' }, now)).toEqual([
      'The date is in the past. Check the year.',
    ]);
  });

  it('flags missing fields', () => {
    const checks = fieldsToCheck(
      { title: ' ', startDateTime: '', artists: [{ name: '' }], extractionConfidence: 0.9 },
      now
    );
    expect(checks).toEqual([
      'No title was found.',
      'No date or time was found.',
      'No venue was found.',
      'No performers were found.',
    ]);
  });

  it('names what would be created as a new record', () => {
    const checks = fieldsToCheck(
      {
        ...good,
        venue: { name: 'Gayana Samaaja' },
        organiser: { name: 'GS Trust' },
        artists: [{ name: 'Savita Vasu', id: 'a1' }, { name: 'R. Kumar' }],
      },
      now
    );
    expect(checks).toEqual([
      '"Gayana Samaaja" is a new venue to us. Check the spelling.',
      '"GS Trust" is a new organiser to us. Check the spelling.',
      'New performers to us: R. Kumar. Check each name.',
    ]);
  });
});
