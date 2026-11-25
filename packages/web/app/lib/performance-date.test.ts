import { describe, expect, it } from 'vitest';
import { eventDateKey, formatDayLabel } from './event-time';
import { eventListingDescription } from './listing-description';
import { readPerformanceDate } from './performance-date';
import { eventJsonLd } from './structured-data';
import { formatEventDate } from './utils';

const now = new Date('2026-11-25T00:00:00Z');

describe('readPerformanceDate', () => {
  it('reads a full date at noon in India', () => {
    expect(readPerformanceDate('2019-08-14', '', now)).toEqual({
      startDateTime: '2019-08-14T06:30:00.000Z',
      datePrecision: 'exact',
    });
  });
  it('reads a bare year', () => {
    expect(readPerformanceDate('', '2019', now)).toEqual({
      startDateTime: '2019-01-01T06:30:00.000Z',
      datePrecision: 'year',
    });
  });
  it('refuses neither, both, and a year that cannot be', () => {
    for (const [date, year] of [
      ['', ''],
      ['2019-08-14', '2019'],
      ['', '2027'],
      ['', '19'],
      ['', '2019.5'],
    ]) {
      expect(readPerformanceDate(date, year, now)).toHaveProperty('error');
    }
  });
});

describe('a year-only event is printed as its year', () => {
  const event = {
    title: 'Kutcheri',
    startDateTime: '2019-01-01T06:30:00.000Z',
    datePrecision: 'year',
  };
  it('in dates and day headers', () => {
    expect(formatEventDate(event.startDateTime, 'year')).toBe('2019');
    expect(formatDayLabel(eventDateKey(event), { year: true })).toBe('2019');
  });
  it('in a listing description', () => {
    const text = eventListingDescription({
      name: 'The Academy',
      events: [event],
      preposition: 'at',
      fallback: '',
      now,
    });
    expect(text).toContain('Kutcheri in 2019.');
    expect(text).not.toContain('Jan');
  });
  it('in JSON-LD, with no end date', () => {
    const ld = eventJsonLd({
      ...event,
      url: 'https://rasika.life/events/x',
      endDateTime: '2019-01-01T08:00:00.000Z',
    });
    expect(ld.startDate).toBe('2019');
    expect(JSON.parse(JSON.stringify(ld))).not.toHaveProperty('endDate');
  });
});
