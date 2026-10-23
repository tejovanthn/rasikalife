import { describe, expect, it } from 'vitest';
import { eventDateKey, formatDayLabel, formatEventTime, groupByEventDate } from './event-time';

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
