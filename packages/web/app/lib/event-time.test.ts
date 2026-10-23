import { describe, expect, it } from 'vitest';
import {
  eventDateKey,
  formatDayLabel,
  formatEventDate,
  formatEventTime,
  groupByEventDate,
  needsZoneLabel,
  zoneLabel,
} from './event-time';

describe('formatEventTime', () => {
  it('prints the time where the concert happens, not where the server runs', () => {
    expect(formatEventTime('2026-10-23T12:30:00Z')).toBe('6:00 pm');
    expect(formatEventTime('2026-10-23T18:00:00+05:30')).toBe('6:00 pm');
    expect(formatEventTime('2026-10-26T03:00:00Z', 'America/Los_Angeles')).toBe('8:00 pm');
  });
});

describe('eventDateKey', () => {
  it('reads the day in the event zone', () => {
    // 19:00Z is 00:30 the next day in India.
    expect(eventDateKey({ startDateTime: '2026-10-23T19:00:00Z' })).toBe('2026-10-24');
  });
});

describe('formatDayLabel', () => {
  it('names the day without a zone moving it', () => {
    expect(formatDayLabel('2026-10-24')).toBe('Sat, 24 Oct');
  });
});

describe('groupByEventDate', () => {
  it('groups by local day and orders across offsets', () => {
    const groups = groupByEventDate([
      { id: 'b', startDateTime: '2026-10-24T18:00:00+05:30' },
      { id: 'a', startDateTime: '2026-10-24T10:00:00Z' },
      { id: 'c', startDateTime: '2026-10-23T18:00:00+05:30' },
    ]);
    expect(groups.map(g => [g.date, g.events.map(e => e.id)])).toEqual([
      ['2026-10-23', ['c']],
      ['2026-10-24', ['a', 'b']],
    ]);
  });
});

describe('zoneLabel', () => {
  it('uses the common abbreviation where one exists', () => {
    expect(zoneLabel('2026-10-23T12:30:00Z', 'Asia/Kolkata')).toBe('IST');
    expect(zoneLabel('2026-10-23T12:30:00Z', 'America/Los_Angeles')).toBe('PDT');
    expect(zoneLabel('2026-12-23T12:30:00Z', 'America/Los_Angeles')).toBe('PST');
    expect(zoneLabel('2026-07-01T12:00:00Z', 'Europe/London')).toBe('BST');
  });

  it('falls back to an offset', () => {
    expect(zoneLabel('2026-10-23T12:30:00Z', 'Asia/Singapore')).toBe('GMT+8');
  });
});

describe('needsZoneLabel', () => {
  const iso = '2026-10-23T12:30:00Z';

  it('labels a concert outside India for everyone', () => {
    expect(needsZoneLabel(iso, 'America/Los_Angeles')).toBe(true);
  });

  it('leaves an Indian concert bare for a reader in India or with no zone known', () => {
    expect(needsZoneLabel(iso, 'Asia/Kolkata')).toBe(false);
    expect(needsZoneLabel(iso, 'Asia/Kolkata', 'Asia/Kolkata')).toBe(false);
    // The old name of the same zone is the same zone.
    expect(needsZoneLabel(iso, 'Asia/Kolkata', 'Asia/Calcutta')).toBe(false);
  });

  it('labels an Indian concert for a reader abroad', () => {
    expect(needsZoneLabel(iso, 'Asia/Kolkata', 'America/New_York')).toBe(true);
  });
});

describe('formatEventDate', () => {
  it('reads the day in the event zone', () => {
    expect(
      formatEventDate('2026-10-23T19:00:00Z', 'Asia/Kolkata', { day: 'numeric', month: 'short' })
    ).toBe('24 Oct');
  });
});
