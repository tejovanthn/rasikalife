import { describe, expect, it } from 'vitest';
import {
  AddConcertSchema,
  CalendarDateSchema,
  ClockTimeSchema,
  concertStart,
  isRealDate,
  mayAutoApprove,
  parseArtistNames,
} from './add-concert';

describe('calendar validation', () => {
  it('refuses days that do not exist', () => {
    expect(isRealDate('2026-02-31')).toBe(false);
    expect(isRealDate('2026-13-01')).toBe(false);
    expect(isRealDate('2026-04-31')).toBe(false);
    expect(isRealDate('2026-02-29')).toBe(false);
    expect(isRealDate('2028-02-29')).toBe(true);
    expect(CalendarDateSchema.safeParse('2026-02-31').success).toBe(false);
    expect(CalendarDateSchema.safeParse('2026-12-05').success).toBe(true);
    expect(ClockTimeSchema.safeParse('25:00').success).toBe(false);
    expect(ClockTimeSchema.safeParse('18:30').success).toBe(true);
  });
  it('gives the add-a-concert form a validation error, not a throw', () => {
    const result = AddConcertSchema.safeParse({
      code: 'ABCDEFGH',
      title: 'x',
      date: '2026-02-31',
      startTime: '18:30',
    });
    expect(result.success).toBe(false);
  });
});

describe('add concert rules', () => {
  it('parses artist names from lines and commas', () => {
    expect(parseArtistNames('A  B, C\n\n D ,')).toEqual([
      { name: 'A B' },
      { name: 'C' },
      { name: 'D' },
    ]);
    expect(parseArtistNames(undefined)).toEqual([]);
    expect(parseArtistNames(Array.from({ length: 20 }, (_, i) => `n${i}`).join(','))).toHaveLength(
      12
    );
  });

  it('keeps the hall wall clock and adds the offset', () => {
    expect(concertStart('2026-11-16', '18:30')).toBe('2026-11-16T18:30:00+05:30');
  });

  it('validates the form', () => {
    const ok = { code: 'ABCDEFGH', title: ' Vocal ', date: '2026-11-16', startTime: '18:30' };
    expect(AddConcertSchema.parse(ok).title).toBe('Vocal');
    expect(AddConcertSchema.safeParse({ ...ok, startTime: '6pm' }).success).toBe(false);
    expect(AddConcertSchema.safeParse({ ...ok, title: ' ' }).success).toBe(false);
    expect(AddConcertSchema.safeParse({ ...ok, code: 'abc' }).success).toBe(false);
  });

  it('auto-approves only a verified organiser owner', () => {
    expect(mayAutoApprove({ role: 'owner' }, { verifiedAt: '2026-11-01' })).toBe(true);
    expect(mayAutoApprove({ role: 'viewer' }, { verifiedAt: '2026-11-01' })).toBe(false);
    expect(mayAutoApprove({ role: 'owner' }, {})).toBe(false);
    expect(mayAutoApprove(null, { verifiedAt: '2026-11-01' })).toBe(false);
    expect(
      mayAutoApprove({ role: 'owner' }, { verifiedAt: '2026-11-01', requireEventReview: true })
    ).toBe(false);
    expect(
      mayAutoApprove({ role: 'owner' }, { verifiedAt: '2026-11-01', requireEventReview: false })
    ).toBe(true);
  });
});
