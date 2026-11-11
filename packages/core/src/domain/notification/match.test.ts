import { describe, expect, it } from 'vitest';
import { formatDateRange, formatDay, formatTime } from './format';
import {
  buildUserEntries,
  reasonLine,
  scoreReasons,
  selectForDigest,
  selectForReminder,
  startsTomorrow,
  targetsOfEvent,
  withoutLogged,
} from './match';
import type { NotifyEvent, Reason, UserEntry } from './match';

const ev = (id: string, start: string, extra: Partial<NotifyEvent> = {}): NotifyEvent => ({
  id,
  title: `Concert ${id}`,
  startDateTime: start,
  timezone: 'Asia/Kolkata',
  venueId: 'v1',
  venueName: 'Gayana Samaja',
  organiserId: 'o1',
  organiserName: 'Narada Gana Sabha',
  ...extra,
});

const entry = (id: string, start: string, reasons: Reason[]): UserEntry => ({
  event: ev(id, start),
  reasons,
  score: scoreReasons(reasons),
  rsvp: reasons.some(r => r.kind === 'rsvp'),
});

const follow = (type: 'venue' | 'organiser' | 'artist', name: string): Reason => ({
  kind: 'follow',
  type,
  id: name,
  name,
});

describe('targetsOfEvent', () => {
  it('lists venue, organiser and each artist once', () => {
    const targets = targetsOfEvent(ev('e1', '2026-11-20T18:00:00+05:30'), [
      { artistId: 'a1', artistName: 'TMK' },
      { artistId: 'a1', artistName: 'TMK' },
    ]);
    expect(targets.map(t => `${t.type}:${t.id}`)).toEqual([
      'venue:v1',
      'organiser:o1',
      'artist:a1',
    ]);
  });

  it('skips a missing venue or organiser', () => {
    const targets = targetsOfEvent(
      ev('e1', '2026-11-20T18:00:00+05:30', { venueId: undefined, organiserId: undefined }),
      []
    );
    expect(targets).toEqual([]);
  });
});

describe('buildUserEntries', () => {
  it('dedupes an event reached through several follows and adds RSVPs', () => {
    const e = ev('e1', '2026-11-20T18:00:00+05:30');
    const result = buildUserEntries({
      events: [e],
      targetsByEvent: new Map([
        [
          'e1',
          [
            { type: 'venue', id: 'v1', name: 'Gayana Samaja' },
            { type: 'artist', id: 'a1', name: 'TMK' },
          ],
        ],
      ]),
      followersByTarget: new Map([
        ['venue:v1', ['u1', 'u2']],
        ['artist:a1', ['u1']],
      ]),
      rsvpUsersByEvent: new Map([['e1', ['u2']]]),
    });
    const u1 = result.get('u1') ?? [];
    expect(u1).toHaveLength(1);
    expect(u1[0]?.score).toBe(1 + 3);
    const u2 = result.get('u2') ?? [];
    expect(u2[0]?.rsvp).toBe(true);
    expect(u2[0]?.score).toBe(10 + 1);
  });
});

describe('selectForDigest', () => {
  it('sorts by date and keeps the best 15 with the total', () => {
    const entries = Array.from({ length: 20 }, (_, i) =>
      entry(
        `e${String(i).padStart(2, '0')}`,
        `2026-11-${String(10 + i).padStart(2, '0')}T12:00:00Z`,
        [follow(i === 19 ? 'artist' : 'venue', 'X')]
      )
    );
    const { shown, total } = selectForDigest(entries);
    expect(total).toBe(20);
    expect(shown).toHaveLength(15);
    expect(shown.map(s => s.event.id)).toContain('e19');
    const dates = shown.map(s => Date.parse(s.event.startDateTime));
    expect([...dates].sort((a, b) => a - b)).toEqual(dates);
  });
});

describe('selectForReminder', () => {
  it('caps at 3 by score and keeps every RSVP outside the cap', () => {
    const entries = [
      entry('r1', '2026-11-21T10:00:00Z', [{ kind: 'rsvp' }]),
      entry('r2', '2026-11-21T11:00:00Z', [{ kind: 'rsvp' }]),
      entry('a', '2026-11-21T12:00:00Z', [follow('artist', 'A')]),
      entry('b', '2026-11-21T13:00:00Z', [follow('organiser', 'B')]),
      entry('c', '2026-11-21T14:00:00Z', [follow('venue', 'C')]),
      entry('d', '2026-11-21T15:00:00Z', [follow('artist', 'D')]),
    ];
    const ids = selectForReminder(entries).map(e => e.event.id);
    expect(ids).toEqual(['r1', 'r2', 'a', 'b', 'd']);
  });
});

describe('withoutLogged', () => {
  it('drops events already in the concert book', () => {
    const entries = [entry('e1', '2026-11-21T10:00:00Z', [follow('venue', 'V')])];
    expect(withoutLogged('u1', entries, new Set(['u1:e1']))).toEqual([]);
    expect(withoutLogged('u2', entries, new Set(['u1:e1']))).toHaveLength(1);
  });
});

describe('reasonLine', () => {
  it('uses the RSVP line first', () => {
    expect(reasonLine([follow('venue', 'V'), { kind: 'rsvp' }])).toBe("You said you're going");
  });
  it('names two follows, artists first', () => {
    expect(reasonLine([follow('venue', 'Hall'), follow('artist', 'TMK')])).toBe(
      'Because you follow TMK and Hall'
    );
  });
  it('counts the rest from three follows', () => {
    expect(
      reasonLine([
        follow('artist', 'A'),
        follow('artist', 'B'),
        follow('organiser', 'C'),
        follow('venue', 'D'),
      ])
    ).toBe('Because you follow A, B and 2 more');
  });
});

describe('startsTomorrow', () => {
  it('reads the day in the event zone, not UTC', () => {
    // 20 Nov 20:00 UTC is 21 Nov 01:30 in India. At 18:00 IST on 20 Nov it is "tomorrow".
    const now = new Date('2026-11-20T12:30:00Z');
    expect(startsTomorrow(ev('e', '2026-11-20T20:00:00Z'), now)).toBe(true);
    expect(startsTomorrow(ev('e', '2026-11-20T10:00:00Z'), now)).toBe(false);
    expect(startsTomorrow(ev('e', '2026-11-22T10:00:00Z'), now)).toBe(false);
  });
});

describe('formatting', () => {
  it('prints Copy shapes in the event zone', () => {
    expect(formatDay('2026-11-16T12:30:00Z', 'Asia/Kolkata')).toBe('Mon 16 Nov');
    expect(formatTime('2026-11-16T12:30:00Z', 'Asia/Kolkata')).toBe('6:00 pm');
    expect(formatTime('2026-11-16T03:00:00Z', 'Asia/Kolkata')).toBe('8:30 am');
    expect(formatDateRange('2026-11-16', '2026-11-29')).toBe('16 to 29 Nov');
    expect(formatDateRange('2026-11-28', '2026-12-11')).toBe('28 Nov to 11 Dec');
  });
});
