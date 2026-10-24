import { describe, expect, it } from 'vitest';
import { partitionSubmitted, submittedDigestOptions } from './submitted-events';

const event = (id: string, status: string, createdBy = 'u1') => ({
  id,
  title: `Concert ${id}`,
  startDateTime: '2026-11-01T18:00:00+05:30',
  status,
  createdBy,
});

describe('partitionSubmitted', () => {
  const events = [
    event('a', 'approved'),
    event('b', 'submitted'),
    event('c', 'draft'),
    event('d', 'rejected'),
    event('e', 'submitted', 'u2'),
  ];

  it('splits own events into live and waiting, and drops drafts and rejections', () => {
    const { live, inReview } = partitionSubmitted(events, { id: 'u1', isModerator: false });
    expect(live.map(e => e.id)).toEqual(['a']);
    expect(inReview.map(e => e.id)).toEqual(['b']);
  });

  it("does not show a viewer someone else's event named in the URL", () => {
    const { inReview } = partitionSubmitted(events, { id: 'u1', isModerator: false });
    expect(inReview.map(e => e.id)).not.toContain('e');
  });

  it('shows a moderator every event', () => {
    const { inReview } = partitionSubmitted(events, { id: 'u9', isModerator: true });
    expect(inReview.map(e => e.id)).toEqual(['b', 'e']);
  });
});

describe('submittedDigestOptions', () => {
  const eventUrl = (e: { id: string }) => `/events/x-${e.id}`;

  it('makes one concert its own listing and does not print its link twice', () => {
    const opts = submittedDigestOptions([event('a', 'approved')], { eventUrl });
    expect(opts.heading).toBe('Concert a');
    expect(opts.listingUrl).toBe('https://rasika.life/events/x-a');
    expect(opts.links).toBe(false);
  });

  it('ends several concerts with their festival', () => {
    const opts = submittedDigestOptions([event('a', 'approved'), event('b', 'approved')], {
      eventUrl,
      festival: { name: 'Margazhi Utsavam', url: '/festivals/m-1' },
    });
    expect(opts.heading).toBe('Margazhi Utsavam');
    expect(opts.listingUrl).toBe('https://rasika.life/festivals/m-1');
    expect(opts.links).toBeUndefined();
    expect(opts.eventUrl(event('b', 'approved'))).toBe('https://rasika.life/events/x-b');
  });

  it('falls back to the concerts page without a festival', () => {
    const opts = submittedDigestOptions([event('a', 'approved'), event('b', 'approved')], {
      eventUrl,
    });
    expect(opts.listingUrl).toBe('https://rasika.life/events');
  });
});
