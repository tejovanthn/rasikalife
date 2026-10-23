import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listUpcomingListings } from './event-listing';

vi.mock('./event', () => ({ listAllUpcomingEvents: vi.fn() }));
vi.mock('./venue', () => ({ getVenuesByIds: vi.fn() }));

describe('listUpcomingListings', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reads the city and coordinates off the venue, before the event copy', async () => {
    const { listAllUpcomingEvents } = await import('./event');
    const { getVenuesByIds } = await import('./venue');
    vi.mocked(listAllUpcomingEvents).mockResolvedValue([
      { id: 'e1', title: 'A', startDateTime: '2026-10-24T18:00:00+05:30', venueId: 'v1' },
      { id: 'e2', title: 'B', startDateTime: '2026-10-25T18:00:00+05:30', venueCity: 'Chennai' },
      { id: 'e3', title: 'C', startDateTime: '2026-10-26T18:00:00+05:30', venueId: 'v2' },
    ] as never);
    vi.mocked(getVenuesByIds).mockResolvedValue([
      {
        id: 'v1',
        name: 'Hall',
        address: { city: 'Bangalore' },
        lat: 13,
        lng: 77.5,
        geoSource: 'map-link',
      },
      // Half a coordinate is no coordinate.
      { id: 'v2', name: 'Other', city: 'Mysuru', lat: 12.3 },
    ] as never);

    const result = await listUpcomingListings();

    expect(getVenuesByIds).toHaveBeenCalledWith(['v1', 'v2']);
    expect(result[0]).toMatchObject({
      city: 'Bangalore',
      citySlug: 'bengaluru',
      venueLat: 13,
      venueLng: 77.5,
      venueGeoSource: 'map-link',
    });
    expect(result[1]).toMatchObject({ city: 'Chennai', citySlug: 'chennai' });
    expect(result[2]).toMatchObject({ city: 'Mysuru', citySlug: 'mysuru' });
    expect(result[2].venueLat).toBeUndefined();
  });
});
