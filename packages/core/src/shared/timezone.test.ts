import { describe, expect, it } from 'vitest';
import {
  addDaysToDate,
  dateInTimeZone,
  isDateOnly,
  startOfDayInstant,
  todayInTimeZone,
} from './timezone';

describe('dateInTimeZone', () => {
  it('gives the teacher a later date than the student for one instant', () => {
    // An 8am Tuesday class in Chennai. The student in New York experienced it on Monday
    // evening, and the ledger has to pick one of those days.
    const instant = '2026-08-04T02:30:00.000Z';

    expect(dateInTimeZone(instant, 'Asia/Kolkata')).toBe('2026-08-04');
    expect(dateInTimeZone(instant, 'America/New_York')).toBe('2026-08-03');
  });

  it('pads month and day, so the string always sorts', () => {
    expect(dateInTimeZone('2026-01-05T12:00:00.000Z', 'UTC')).toBe('2026-01-05');
  });

  it('accepts a Date, a string or a number', () => {
    const iso = '2026-08-04T12:00:00.000Z';
    expect(dateInTimeZone(new Date(iso), 'UTC')).toBe('2026-08-04');
    expect(dateInTimeZone(iso, 'UTC')).toBe('2026-08-04');
    expect(dateInTimeZone(Date.parse(iso), 'UTC')).toBe('2026-08-04');
  });
});

describe('todayInTimeZone', () => {
  it("reads the teacher's wall, not the caller's", () => {
    const now = new Date('2026-08-03T19:00:00.000Z');

    // 19:00Z is still Monday in New York and already Tuesday in Chennai.
    expect(todayInTimeZone('America/New_York', now)).toBe('2026-08-03');
    expect(todayInTimeZone('Asia/Kolkata', now)).toBe('2026-08-04');
  });
});

describe('addDaysToDate', () => {
  it('adds days', () => {
    expect(addDaysToDate('2026-08-03', 7)).toBe('2026-08-10');
  });

  it('crosses a month and a year', () => {
    expect(addDaysToDate('2026-08-28', 7)).toBe('2026-09-04');
    expect(addDaysToDate('2026-12-30', 7)).toBe('2027-01-06');
  });

  it('crosses a leap day', () => {
    expect(addDaysToDate('2028-02-26', 7)).toBe('2028-03-04');
  });

  it('rejects anything that is not a date', () => {
    expect(() => addDaysToDate('not-a-date', 1)).toThrow();
  });
});

describe('startOfDayInstant', () => {
  it('is 18:30Z the previous day for a zone 5:30 ahead', () => {
    expect(startOfDayInstant('2026-08-04', 'Asia/Kolkata')).toBe('2026-08-03T18:30:00.000Z');
  });

  it('is the same instant for UTC', () => {
    expect(startOfDayInstant('2026-08-04', 'UTC')).toBe('2026-08-04T00:00:00.000Z');
  });

  /**
   * The single-pass version of this reads the zone's offset at midnight *UTC*, which for a
   * western zone is still the previous evening — and around a DST boundary that evening sits
   * in the other offset. New York is UTC-4 in summer and UTC-5 in winter, so asking on the
   * changeover morning gives an answer an hour out.
   */
  it('lands on the right side of a DST change', () => {
    // Clocks go back at 2am local on 2026-11-01, so that day starts at UTC-4 and ends at UTC-5.
    expect(startOfDayInstant('2026-11-01', 'America/New_York')).toBe('2026-11-01T04:00:00.000Z');
    // And the day after is wholly in standard time.
    expect(startOfDayInstant('2026-11-02', 'America/New_York')).toBe('2026-11-02T05:00:00.000Z');
    // Clocks go forward at 2am local on 2026-03-08.
    expect(startOfDayInstant('2026-03-08', 'America/New_York')).toBe('2026-03-08T05:00:00.000Z');
    expect(startOfDayInstant('2026-03-09', 'America/New_York')).toBe('2026-03-09T04:00:00.000Z');
  });

  it('round-trips: the start of a day reads back as that day', () => {
    for (const zone of ['Asia/Kolkata', 'America/New_York', 'Europe/London', 'Pacific/Auckland']) {
      for (const date of ['2026-01-15', '2026-03-08', '2026-07-04', '2026-11-01']) {
        expect(dateInTimeZone(startOfDayInstant(date, zone), zone)).toBe(date);
      }
    }
  });

  it('rejects anything that is not a date', () => {
    expect(() => startOfDayInstant('2026-08', 'UTC')).toThrow();
  });
});

describe('isDateOnly', () => {
  it('accepts YYYY-MM-DD and nothing else', () => {
    expect(isDateOnly('2026-08-04')).toBe(true);
    expect(isDateOnly('2026-8-4')).toBe(false);
    expect(isDateOnly('2026-08-04T00:00:00Z')).toBe(false);
    expect(isDateOnly('')).toBe(false);
  });
});
