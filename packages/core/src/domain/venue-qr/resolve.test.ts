import { describe, expect, it } from 'vitest';
import {
  classifyScanEvents,
  eventEndMs,
  isLaterToday,
  isLive,
  organisersOf,
  outcomeFor,
  scanQueryRange,
} from './resolve';
import type { ScanEvent } from './resolve';

// 2026-11-16 (Mon). IST is UTC+5:30, so 18:00 IST is 12:30Z.
const at = (iso: string) => new Date(iso);
let n = 0;
function ev(start: string, extra: Partial<ScanEvent> = {}): ScanEvent {
  n += 1;
  return {
    id: `e${n}`,
    title: `Concert ${n}`,
    startDateTime: start,
    status: 'approved',
    timezone: 'Asia/Kolkata',
    ...extra,
  };
}

describe('isLive', () => {
  const e = ev('2026-11-16T18:00:00+05:30', { endDateTime: '2026-11-16T20:00:00+05:30' });
  it('opens 90 minutes before the start', () => {
    expect(isLive(e, at('2026-11-16T16:29:00+05:30'))).toBe(false);
    expect(isLive(e, at('2026-11-16T16:30:00+05:30'))).toBe(true);
  });
  it('closes 30 minutes after the end', () => {
    expect(isLive(e, at('2026-11-16T20:30:00+05:30'))).toBe(true);
    expect(isLive(e, at('2026-11-16T20:31:00+05:30'))).toBe(false);
  });
  it('defaults a missing end to start plus 3 hours', () => {
    const open = ev('2026-11-16T18:00:00+05:30');
    expect(new Date(eventEndMs(open)).toISOString()).toBe('2026-11-16T15:30:00.000Z');
    expect(isLive(open, at('2026-11-16T21:30:00+05:30'))).toBe(true);
    expect(isLive(open, at('2026-11-16T21:31:00+05:30'))).toBe(false);
  });
  it('treats an end before the start as missing', () => {
    const bad = ev('2026-11-16T18:00:00+05:30', { endDateTime: '2026-11-16T10:00:00+05:30' });
    expect(isLive(bad, at('2026-11-16T20:00:00+05:30'))).toBe(true);
  });
});

describe('isLaterToday', () => {
  const now = at('2026-11-16T10:00:00+05:30');
  it('is true for a later start on the same day in the event zone', () => {
    expect(isLaterToday(ev('2026-11-16T18:00:00+05:30'), now)).toBe(true);
  });
  it('is false for tomorrow and for the past', () => {
    expect(isLaterToday(ev('2026-11-17T09:00:00+05:30'), now)).toBe(false);
    expect(isLaterToday(ev('2026-11-16T08:00:00+05:30'), now)).toBe(false);
  });
  it('reads the day in the event own zone, not the runtime zone', () => {
    // 23:00 IST on the 16th is 17:30Z. In Los Angeles "now" (10:00 IST) is the 15th evening.
    const la = ev('2026-11-16T09:00:00-08:00', { timezone: 'America/Los_Angeles' });
    const laNow = at('2026-11-16T08:00:00Z'); // 00:00 on the 16th in LA
    expect(isLaterToday(la, laNow)).toBe(true);
    const sameInstantOtherDay = ev('2026-11-17T01:00:00Z', { timezone: 'America/Los_Angeles' });
    // 17:00 on the 16th in LA: still today there.
    expect(isLaterToday(sameInstantOtherDay, laNow)).toBe(true);
  });
});

describe('classifyScanEvents and outcomeFor', () => {
  const now = at('2026-11-16T17:30:00+05:30');

  it('0 events today is venue mode with the organisers of the next 3', () => {
    const next = [
      ev('2026-11-20T18:00:00+05:30', { organiserId: 'o1', organiserName: 'Sabha A' }),
      ev('2026-11-21T18:00:00+05:30', { organiserId: 'o1', organiserName: 'Sabha A' }),
      ev('2026-11-22T18:00:00+05:30', { organiserId: 'o2', organiserName: 'Sabha B' }),
      ev('2026-11-23T18:00:00+05:30', { organiserId: 'o3', organiserName: 'Sabha C' }),
    ];
    const out = outcomeFor(classifyScanEvents(next, { now }));
    expect(out.state).toBe('venue');
    if (out.state !== 'venue') return;
    expect(out.upcoming).toHaveLength(3);
    expect(out.organisers).toEqual([
      { id: 'o1', name: 'Sabha A' },
      { id: 'o2', name: 'Sabha B' },
    ]);
  });

  it('1 live event resolves to it', () => {
    const live = ev('2026-11-16T18:00:00+05:30');
    const out = outcomeFor(classifyScanEvents([live, ev('2026-11-18T18:00:00+05:30')], { now }));
    expect(out).toMatchObject({ state: 'live', event: { id: live.id } });
  });

  it('2+ live events (two halls) is a picker, soonest first', () => {
    const b = ev('2026-11-16T18:30:00+05:30');
    const a = ev('2026-11-16T18:00:00+05:30');
    const out = outcomeFor(classifyScanEvents([b, a], { now }));
    expect(out.state).toBe('picker');
    if (out.state === 'picker') expect(out.events.map(e => e.id)).toEqual([a.id, b.id]);
  });

  it('0 live and one later today lists today', () => {
    const late = ev('2026-11-16T21:00:00+05:30');
    const out = outcomeFor(classifyScanEvents([late], { now: at('2026-11-16T09:00:00+05:30') }));
    expect(out).toMatchObject({ state: 'later', events: [{ id: late.id }] });
  });

  it('keeps a concert that crossed midnight live after midnight', () => {
    const late = ev('2026-11-16T22:30:00+05:30', { endDateTime: '2026-11-17T00:45:00+05:30' });
    const out = outcomeFor(
      classifyScanEvents([late], { now: at('2026-11-17T00:10:00+05:30') })
    );
    expect(out).toMatchObject({ state: 'live', event: { id: late.id } });
  });

  it('a concert that crosses midnight on the default 3 hours also resolves', () => {
    const late = ev('2026-11-16T22:30:00+05:30');
    const out = outcomeFor(
      classifyScanEvents([late], { now: at('2026-11-17T01:00:00+05:30') })
    );
    expect(out.state).toBe('live');
  });

  it('an event just after midnight is later today only on its own date', () => {
    const early = ev('2026-11-17T00:30:00+05:30');
    // At 21:00 on the 16th it is inside the 90 minute window (23:00 not yet), so later, not today.
    const c = classifyScanEvents([early], { now: at('2026-11-16T21:00:00+05:30') });
    expect(c.laterToday).toHaveLength(0);
    expect(c.upcoming).toHaveLength(1);
  });

  it('drops unapproved, deleted and merged events', () => {
    const rows = [
      ev('2026-11-16T18:00:00+05:30', { status: 'submitted' }),
      ev('2026-11-16T18:00:00+05:30', { deletedAt: '2026-11-01T00:00:00Z' }),
      ev('2026-11-16T18:00:00+05:30', { mergedIntoId: 'x' }),
    ];
    expect(outcomeFor(classifyScanEvents(rows, { now })).state).toBe('venue');
  });

  it('ignores events already over', () => {
    const over = ev('2026-11-16T09:00:00+05:30', { endDateTime: '2026-11-16T11:00:00+05:30' });
    expect(outcomeFor(classifyScanEvents([over], { now })).state).toBe('venue');
  });

  describe('spaces', () => {
    const hall = ev('2026-11-16T18:00:00+05:30', { spaceId: 's-main' });
    const mini = ev('2026-11-16T18:00:00+05:30', { spaceId: 's-mini' });
    const any = ev('2026-11-16T18:15:00+05:30');

    it('with a space, keeps that space and events with no space', () => {
      const out = outcomeFor(classifyScanEvents([hall, mini, any], { now, spaceId: 's-main' }));
      expect(out.state).toBe('picker');
      if (out.state === 'picker') {
        expect(out.events.map(e => e.id)).toEqual([hall.id, any.id]);
      }
    });

    it('the picker is skipped when only one still matches', () => {
      const out = outcomeFor(classifyScanEvents([hall, mini], { now, spaceId: 's-main' }));
      expect(out).toMatchObject({ state: 'live', event: { id: hall.id } });
    });

    it('with no space on the code, every hall counts', () => {
      expect(outcomeFor(classifyScanEvents([hall, mini], { now })).state).toBe('picker');
    });
  });
});

describe('helpers', () => {
  it('organisersOf dedupes in order', () => {
    expect(
      organisersOf([
        ev('2026-11-20T18:00:00Z', { organiserId: 'a', organiserName: 'A' }),
        ev('2026-11-21T18:00:00Z', { organiserId: 'a', organiserName: 'A' }),
        ev('2026-11-22T18:00:00Z'),
        ev('2026-11-23T18:00:00Z', { organiserId: 'b', organiserName: 'B' }),
      ])
    ).toEqual([
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
    ]);
  });

  it('scanQueryRange pads by whole days', () => {
    expect(scanQueryRange(at('2026-11-16T10:00:00Z'))).toEqual({
      from: '2026-11-14',
      to: '2026-11-19',
    });
  });
});
