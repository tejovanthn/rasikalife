import { describe, expect, it } from 'vitest';
import { draftBatches, groupMyEvents } from './my-events';

const event = (id: string, status: string, extra: Record<string, string> = {}) => ({
  id,
  title: `Concert ${id}`,
  startDateTime: '2026-11-01T18:00:00+05:30',
  status,
  ...extra,
});

describe('draftBatches', () => {
  it("resumes one poster's drafts together", () => {
    const [batch, ...rest] = draftBatches([
      event('a', 'draft', { posterUrl: 'https://cdn/p1.jpg', festivalId: 'f1' }),
      event('b', 'draft', { posterUrl: 'https://cdn/p1.jpg', festivalId: 'f1' }),
    ]);
    expect(rest).toEqual([]);
    const url = new URL(batch.href, 'https://rasika.life');
    expect(url.pathname).toBe('/events/new/verify');
    expect(url.searchParams.getAll('eventId')).toEqual(['a', 'b']);
    expect(url.searchParams.get('posterUrl')).toBe('https://cdn/p1.jpg');
    expect(url.searchParams.get('festivalId')).toBe('f1');
  });

  it('keeps drafts without a poster apart', () => {
    expect(draftBatches([event('a', 'draft'), event('b', 'draft')])).toHaveLength(2);
  });
});

describe('groupMyEvents', () => {
  it('sorts events by where they stand', () => {
    const now = new Date('2026-10-24T00:00:00Z');
    const groups = groupMyEvents(
      [
        event('d', 'draft'),
        event('s', 'submitted'),
        event('up', 'approved'),
        event('old', 'approved', { startDateTime: '2026-09-01T18:00:00+05:30' }),
        event('r', 'rejected', { moderatorNote: 'Not a performance' }),
      ],
      now
    );
    expect(groups.drafts.flatMap(b => b.events.map(e => e.id))).toEqual(['d']);
    expect(groups.inReview.map(e => e.id)).toEqual(['s']);
    expect(groups.upcoming.map(e => e.id)).toEqual(['up']);
    expect(groups.past.map(e => e.id)).toEqual(['old']);
    expect(groups.rejected.map(e => e.id)).toEqual(['r']);
  });
});
