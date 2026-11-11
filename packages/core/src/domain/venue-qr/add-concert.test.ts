import { describe, expect, it } from 'vitest';
import { AddConcertSchema, concertStart, mayAutoApprove, parseArtistNames } from './add-concert';

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
