import { describe, expect, it } from 'vitest';
import { eventListingDescription } from './listing-description';

const NOW = new Date('2026-08-04T00:00:00Z');

const base = {
  name: 'Chowdiah Memorial Hall',
  preposition: 'at' as const,
  fallback: 'Indian classical arts venue.',
  now: NOW,
};

describe('eventListingDescription', () => {
  it('leads with the count and names the next event', () => {
    const result = eventListingDescription({
      ...base,
      events: [
        { title: 'Veena Recital', startDateTime: '2026-08-20T11:30:00Z' },
        { title: 'Bharathanatyam Rangapravesha', startDateTime: '2026-08-09T11:30:00Z' },
      ],
    });
    expect(result).toContain('2 upcoming events at Chowdiah Memorial Hall');
    // The soonest, not the first in the array.
    expect(result).toContain('Next: Bharathanatyam Rangapravesha');
  });

  it('counts only upcoming events, ignoring past ones', () => {
    const result = eventListingDescription({
      ...base,
      events: [
        { title: 'Last year', startDateTime: '2025-01-01T00:00:00Z' },
        { title: 'Soon', startDateTime: '2026-09-01T00:00:00Z' },
      ],
    });
    expect(result).toContain('1 upcoming event at');
    expect(result).not.toContain('events at');
  });

  it('falls back to past events rather than the generic line', () => {
    // A hall with only past concerts is still the right answer for "<hall> events".
    const result = eventListingDescription({
      ...base,
      events: [
        { title: 'Older', startDateTime: '2025-01-01T00:00:00Z' },
        { title: 'Most recent one', startDateTime: '2026-07-01T00:00:00Z' },
      ],
    });
    expect(result).toContain('2 past events at');
    expect(result).toContain('Most recent: Most recent one');
  });

  it('uses the generic line only when there is nothing at all', () => {
    const result = eventListingDescription({ ...base, events: [] });
    expect(result).toBe(
      'Events and performances at Chowdiah Memorial Hall. Indian classical arts venue.'
    );
  });

  it('includes the location when one is stored', () => {
    const result = eventListingDescription({
      ...base,
      location: 'Bengaluru',
      events: [{ title: 'Recital', startDateTime: '2026-09-01T00:00:00Z' }],
    });
    expect(result).toContain('at Chowdiah Memorial Hall, Bengaluru.');
  });

  it('says "by" for an organiser', () => {
    const result = eventListingDescription({
      ...base,
      name: 'Makaranda Foundation',
      preposition: 'by',
      fallback: 'Indian classical arts performances and concerts.',
      events: [{ title: 'Recital', startDateTime: '2026-09-01T00:00:00Z' }],
    });
    expect(result).toContain('1 upcoming event by Makaranda Foundation');
  });

  it('truncates on a word boundary rather than mid-word', () => {
    const result = eventListingDescription({
      ...base,
      events: [
        {
          title:
            'Sangeetha Mummoorthigal a musical drama presented by the combined students of the academy',
          startDateTime: '2026-09-01T00:00:00Z',
        },
      ],
    });
    expect(result.length).toBeLessThanOrEqual(156);
    expect(result.endsWith('…')).toBe(true);
    expect(result).not.toMatch(/\s…$/);
  });

  it('treats an event starting right now as upcoming', () => {
    const result = eventListingDescription({
      ...base,
      events: [{ title: 'Starting now', startDateTime: NOW.toISOString() }],
    });
    expect(result).toContain('1 upcoming event');
  });
});
