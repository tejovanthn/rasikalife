import { describe, expect, it } from 'vitest';
import { artistEventRow } from './artist-events';

const row = {
  eventId: 'e1',
  eventTitle: 'Margazhi Concert',
  eventStartDateTime: '2026-12-20T12:30:00.000Z',
};

describe('artistEventRow', () => {
  it('carries venue, city and zone from the event record', () => {
    const event = artistEventRow(row, {
      venueName: 'Narada Gana Sabha',
      venueCity: 'Chennai',
      timezone: 'Asia/Kolkata',
      posterUrl: 'https://img/p.jpg',
    });
    expect(event).toMatchObject({
      id: 'e1',
      title: 'Margazhi Concert',
      startDateTime: row.eventStartDateTime,
      venueName: 'Narada Gana Sabha',
      city: 'Chennai',
      timezone: 'Asia/Kolkata',
      posterUrl: 'https://img/p.jpg',
    });
  });

  it('still returns a row when the event record is missing', () => {
    const event = artistEventRow(row, undefined);
    expect(event.venueName).toBeUndefined();
    expect(event.title).toBe('Margazhi Concert');
  });
});
