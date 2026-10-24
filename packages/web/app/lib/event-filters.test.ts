import { describe, expect, it } from 'vitest';
import {
  calendarMonth,
  dayCounts,
  filterEvents,
  groupConsecutiveByDate,
  lastEventMonth,
  listingHref,
  monthGrid,
  rangeDates,
  readListingState,
  resolveDateRange,
  shiftMonth,
  sortByDistance,
} from './event-filters';

// 2026-10-23 is a Friday.
const FRIDAY = '2026-10-23';

describe('resolveDateRange', () => {
  it('reads today', () => {
    expect(resolveDateRange('today', FRIDAY)).toMatchObject({ from: FRIDAY, to: FRIDAY });
  });

  it('puts the weekend on the coming Saturday and Sunday', () => {
    expect(resolveDateRange('weekend', FRIDAY)).toMatchObject({
      from: '2026-10-24',
      to: '2026-10-25',
    });
    expect(resolveDateRange('weekend', '2026-10-24')).toMatchObject({
      from: '2026-10-24',
      to: '2026-10-25',
    });
  });

  it('makes a Sunday weekend today alone, not next Saturday', () => {
    expect(resolveDateRange('weekend', '2026-10-25')).toMatchObject({
      from: '2026-10-25',
      to: '2026-10-25',
    });
  });

  it('runs the week from today to Sunday', () => {
    expect(resolveDateRange('week', FRIDAY)).toMatchObject({ from: FRIDAY, to: '2026-10-25' });
    expect(resolveDateRange('week', '2026-10-26')).toMatchObject({ to: '2026-11-01' });
    expect(resolveDateRange('week', '2026-10-25')).toMatchObject({ to: '2026-10-25' });
  });

  it('reads a month and a day', () => {
    expect(resolveDateRange('2026-02', FRIDAY)).toMatchObject({
      from: '2026-02-01',
      to: '2026-02-28',
      label: 'February 2026',
    });
    expect(resolveDateRange('2026-11-14', FRIDAY)).toMatchObject({
      from: '2026-11-14',
      to: '2026-11-14',
    });
  });

  it('ignores what it cannot read', () => {
    expect(resolveDateRange('2026-02-30', FRIDAY)).toBeNull();
    expect(resolveDateRange('2026-13', FRIDAY)).toBeNull();
    expect(resolveDateRange('tomorrow-ish', FRIDAY)).toBeNull();
    expect(resolveDateRange(null, FRIDAY)).toBeNull();
  });
});

describe('filterEvents', () => {
  const events = [
    // 23:30 IST on the 24th is still the 24th in India, though 18:00Z.
    { id: 'late', startDateTime: '2026-10-24T18:00:00Z', entryType: 'free', citySlug: 'bengaluru' },
    { id: 'ticket', startDateTime: '2026-10-25T18:00:00+05:30', entryType: 'ticketed' },
    { id: 'unknown', startDateTime: '2026-10-25T19:00:00+05:30', citySlug: 'chennai' },
    // Its own zone decides its day: 20:00 in California on the 25th.
    {
      id: 'sunnyvale',
      startDateTime: '2026-10-26T03:00:00Z',
      timezone: 'America/Los_Angeles',
    },
  ];

  it('reads each event on its own local day', () => {
    const range = resolveDateRange('weekend', FRIDAY);
    expect(filterEvents(events, { range }).map(e => e.id)).toEqual([
      'late',
      'ticket',
      'unknown',
      'sunnyvale',
    ]);
    const saturday = resolveDateRange('2026-10-24', FRIDAY);
    expect(filterEvents(events, { range: saturday }).map(e => e.id)).toEqual(['late']);
  });

  it('keeps only events stored as free, never an unknown one', () => {
    expect(filterEvents(events, { free: true }).map(e => e.id)).toEqual(['late']);
  });

  it('filters by city slug', () => {
    expect(filterEvents(events, { citySlug: 'chennai' }).map(e => e.id)).toEqual(['unknown']);
  });
});

describe('counts', () => {
  const events = [
    { startDateTime: '2026-10-24T18:00:00+05:30' },
    { startDateTime: '2026-10-24T19:00:00+05:30' },
    { startDateTime: '2026-11-02T18:00:00+05:30' },
  ];

  it('counts per day and finds the last month with an event', () => {
    expect(dayCounts(events)).toEqual({ '2026-10-24': 2, '2026-11-02': 1 });
    expect(lastEventMonth(dayCounts(events))).toBe('2026-11');
    expect(lastEventMonth({})).toBeNull();
  });
});

describe('monthGrid', () => {
  it('starts on Monday and pads both ends', () => {
    const weeks = monthGrid('2026-10');
    // 1 Oct 2026 is a Thursday.
    expect(weeks[0]).toEqual([
      null,
      null,
      null,
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
    ]);
    expect(weeks.at(-1)).toEqual([
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      null,
    ]);
  });
});

describe('shiftMonth', () => {
  it('crosses a year', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });
});

describe('listingHref', () => {
  it('gives the presets of the whole listing their own path, the rest in the query', () => {
    expect(listingHref({ kind: 'all' }, { when: 'weekend', free: true })).toBe(
      '/events/this-weekend?free=1'
    );
    expect(listingHref({ kind: 'all' }, { when: '2026-11' })).toBe('/events?when=2026-11');
    expect(listingHref({ kind: 'all' }, {})).toBe('/events');
  });

  it('keeps every filter in the query on a city page', () => {
    const city = { kind: 'city', slug: 'bengaluru' } as const;
    expect(listingHref(city, { when: 'weekend' })).toBe('/bengaluru/concerts?when=weekend');
    expect(listingHref(city, { when: '2026-11', free: true })).toBe(
      '/bengaluru/concerts?when=2026-11&free=1'
    );
  });

  it('carries the WhatsApp options only in the WhatsApp view', () => {
    expect(listingHref({ kind: 'all' }, { view: 'whatsapp', cast: false, links: true })).toBe(
      '/events?view=whatsapp&cast=0&links=1'
    );
    expect(listingHref({ kind: 'all' }, { cast: false, links: true })).toBe('/events');
  });

  it('round-trips through readListingState', () => {
    const state = readListingState(
      new URL('https://rasika.life/events/this-week?free=1&view=whatsapp&cast=0'),
      'this-week'
    );
    expect(state).toEqual({
      when: 'week',
      free: true,
      view: 'whatsapp',
      cast: false,
      links: false,
      sort: null,
      cal: null,
    });
    expect(listingHref({ kind: 'all' }, state)).toBe(
      '/events/this-week?free=1&view=whatsapp&cast=0'
    );
  });
});

describe('calendarMonth', () => {
  it('follows the chosen range until the reader browses', () => {
    expect(calendarMonth(null, null, FRIDAY, '2027-10')).toBe('2026-10');
    expect(calendarMonth(null, resolveDateRange('2026-12-05', FRIDAY), FRIDAY, '2027-10')).toBe(
      '2026-12'
    );
    expect(calendarMonth('2027-02', resolveDateRange('today', FRIDAY), FRIDAY, '2027-10')).toBe(
      '2027-02'
    );
  });

  it('holds a browsed month between this month and the last with an event', () => {
    expect(calendarMonth('2026-01', null, FRIDAY, '2027-10')).toBe('2026-10');
    expect(calendarMonth('2030-01', null, FRIDAY, '2027-10')).toBe('2027-10');
    expect(calendarMonth('2026-12', null, FRIDAY, null)).toBe('2026-10');
  });
});

describe('cal', () => {
  it('round-trips through listingHref and readListingState', () => {
    const state = readListingState(
      new URL('https://rasika.life/events/today?cal=2026-12'),
      'today'
    );
    expect(state).toMatchObject({ when: 'today', cal: '2026-12' });
    expect(listingHref({ kind: 'all' }, state)).toBe('/events/today?cal=2026-12');
    const city = { kind: 'city', slug: 'bengaluru' } as const;
    expect(listingHref(city, { when: '2026-11', cal: '2027-01' })).toBe(
      '/bengaluru/concerts?when=2026-11&cal=2027-01'
    );
  });

  it('ignores a cal it cannot read', () => {
    expect(readListingState(new URL('https://rasika.life/events?cal=soon')).cal).toBeNull();
    expect(readListingState(new URL('https://rasika.life/events?cal=2026-13')).cal).toBeNull();
  });

  it('never filters the list', () => {
    const events = [{ startDateTime: '2026-10-24T18:00:00+05:30' }];
    const state = readListingState(new URL('https://rasika.life/events?cal=2027-03'));
    expect(filterEvents(events, { range: resolveDateRange(state.when, FRIDAY) })).toHaveLength(1);
  });
});

describe('sort and stray parameters', () => {
  it('round-trips nearest first', () => {
    const state = readListingState(new URL('https://rasika.life/events?sort=near&free=1'));
    expect(state.sort).toBe('near');
    expect(listingHref({ kind: 'all' }, state)).toBe('/events?free=1&sort=near');
    expect(readListingState(new URL('https://rasika.life/events?sort=far')).sort).toBeNull();
  });

  it('drops pin_error from every link', () => {
    const state = readListingState(
      new URL('https://rasika.life/events/this-weekend?pin_error=unknown-pin'),
      'this-weekend'
    );
    expect(listingHref({ kind: 'all' }, state)).toBe('/events/this-weekend');
  });
});

describe('sortByDistance', () => {
  it('puts the nearest first and events with no distance last, in date order', () => {
    const events = [
      { id: 'a' },
      { id: 'b', distanceKm: 12 },
      { id: 'c', distanceKm: 3 },
      { id: 'd' },
      { id: 'e', distanceKm: 3 },
    ];
    expect(sortByDistance(events).map(e => e.id)).toEqual(['c', 'e', 'b', 'a', 'd']);
  });
});

describe('groupConsecutiveByDate', () => {
  it('starts a new header whenever the day changes, keeping the order given', () => {
    const groups = groupConsecutiveByDate([
      { id: 'near-sat', startDateTime: '2026-10-24T18:00:00+05:30' },
      { id: 'near-sat-2', startDateTime: '2026-10-24T19:00:00+05:30' },
      { id: 'sun', startDateTime: '2026-10-25T18:00:00+05:30' },
      { id: 'far-sat', startDateTime: '2026-10-24T10:00:00+05:30' },
    ]);
    expect(groups.map(g => [g.date, g.events.map(e => e.id)])).toEqual([
      ['2026-10-24', ['near-sat', 'near-sat-2']],
      ['2026-10-25', ['sun']],
      ['2026-10-24', ['far-sat']],
    ]);
  });
});

describe('rangeDates', () => {
  const range = (when: string) => {
    const r = resolveDateRange(when, FRIDAY);
    if (!r) throw new Error(`unreadable: ${when}`);
    return r;
  };

  it('names the days a preset covers, and nothing for a month or a day', () => {
    expect(rangeDates(range('weekend'))).toBe('Sat, 24 Oct – Sun, 25 Oct');
    expect(rangeDates(range('today'))).toBe('Fri, 23 Oct');
    expect(rangeDates(range('2026-11'))).toBeUndefined();
  });
});
