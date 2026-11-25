import { describe, expect, it } from 'vitest';
import { buildEventCardContent } from '../../shared/event-card';
import {
  eventYearLabel,
  isEventYear,
  normaliseStart,
  precisionAfterUpdate,
  yearOnlyStart,
} from './date-precision';
import { findLikelyDuplicates, nearDuplicates } from './duplicates';
import { UpdateEventSchema } from './schema';

const yearOnly = { startDateTime: yearOnlyStart(2019), datePrecision: 'year' };

describe('yearOnlyStart', () => {
  it('is a storable instant that reads as the same year in UTC and India', () => {
    const iso = yearOnlyStart(2019);
    expect(UpdateEventSchema.safeParse({ startDateTime: iso }).success).toBe(true);
    for (const timeZone of ['UTC', 'Asia/Kolkata']) {
      expect(
        new Intl.DateTimeFormat('en', { timeZone, year: 'numeric' }).format(new Date(iso))
      ).toBe('2019');
    }
  });
});

describe('isEventYear', () => {
  const now = new Date('2026-11-25T00:00:00Z');
  it('takes this year and earlier, never a future one', () => {
    expect(isEventYear(2026, now)).toBe(true);
    expect(isEventYear(1985, now)).toBe(true);
    expect(isEventYear(2027, now)).toBe(false);
    expect(isEventYear(1850, now)).toBe(false);
    expect(isEventYear(Number.NaN, now)).toBe(false);
  });
});

describe('eventYearLabel', () => {
  it('is the year for a year-only event and nothing for an exact one', () => {
    expect(eventYearLabel(yearOnly)).toBe('2019');
    expect(eventYearLabel({ startDateTime: yearOnly.startDateTime })).toBeUndefined();
  });
});

describe('normaliseStart', () => {
  it('moves a real-looking day to the placeholder, and leaves an exact date alone', () => {
    expect(
      normaliseStart({ startDateTime: '2019-08-14T17:45:00+05:30', datePrecision: 'year' })
        .startDateTime
    ).toBe(yearOnlyStart(2019));
    expect(normaliseStart({ startDateTime: '2019-08-14T17:45:00+05:30' }).startDateTime).toBe(
      '2019-08-14T17:45:00+05:30'
    );
  });
});

describe('precisionAfterUpdate', () => {
  it('becomes exact when a real date arrives without a precision', () => {
    expect(precisionAfterUpdate(yearOnly, { startDateTime: '2019-08-14T17:45:00+05:30' })).toBe(
      'exact'
    );
  });
  it('stays year when the placeholder is echoed back with an offset', () => {
    expect(precisionAfterUpdate(yearOnly, { startDateTime: '2019-01-01T12:00:00+05:30' })).toBe(
      'year'
    );
  });
  it('stays year on an unrelated edit, and leaves an ordinary event without one', () => {
    expect(precisionAfterUpdate(yearOnly, {})).toBe('year');
    expect(precisionAfterUpdate({ startDateTime: '2026-01-30T17:30:00Z' }, {})).toBeUndefined();
  });
  it('takes an explicit precision', () => {
    expect(
      precisionAfterUpdate({ startDateTime: '2026-01-30T17:30:00Z' }, { datePrecision: 'year' })
    ).toBe('year');
  });
});

describe('a year-only event elsewhere', () => {
  it('is never a duplicate candidate: its time is a placeholder', () => {
    const stored = {
      ...yearOnly,
      id: 'a',
      title: 'T',
      venueId: 'v',
      status: 'approved',
      artists: [],
    };
    const target = { startDateTime: yearOnly.startDateTime, venueId: 'v', title: 'T', artists: [] };
    expect(nearDuplicates([stored], target)).toEqual([]);
    expect(findLikelyDuplicates([stored], target)).toEqual([]);
    expect(findLikelyDuplicates([{ ...stored, datePrecision: 'exact' }], target)).toHaveLength(1);
  });
  it('prints the year and no time on the text card', () => {
    const card = buildEventCardContent({ ...yearOnly, title: 'Kutcheri at the Academy' });
    expect(card.date).toBe('2019');
    expect(card.time).toBeUndefined();
  });
});
