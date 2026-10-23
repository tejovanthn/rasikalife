import { canonicalCitySlug } from '../shared/city';
import { listAllUpcomingEvents } from './event';
import type { EventListing } from './event';
import { getVenuesByIds } from './venue';
import type { VenueGeoSource } from './venue/schema';

/**
 * An upcoming event with what its venue knows: the city, and coordinates for a distance.
 *
 * The city comes from the venue first. `event.venueCity` is a copy taken when the event was
 * submitted, and in Oct 2026 22 of 23 upcoming events had none, while their venues did. Nothing
 * is written back: the venue is the record, and a copy goes stale when it is corrected.
 */
export interface UpcomingListing extends EventListing {
  city?: string;
  citySlug?: string;
  venueLat?: number;
  venueLng?: number;
  venueGeoSource?: VenueGeoSource;
}

export async function listUpcomingListings(from?: Date): Promise<UpcomingListing[]> {
  const events = await listAllUpcomingEvents(from);
  const venues = await getVenuesByIds(
    events.map(event => event.venueId).filter((id): id is string => Boolean(id))
  );
  const byId = new Map(venues.map(venue => [venue.id, venue]));

  return events.map(event => {
    const venue = event.venueId ? byId.get(event.venueId) : undefined;
    const city = venue?.address?.city || venue?.city || event.venueCity || undefined;
    const hasGeo = typeof venue?.lat === 'number' && typeof venue?.lng === 'number';
    return {
      ...event,
      city,
      citySlug: city ? canonicalCitySlug(city) : undefined,
      venueLat: hasGeo ? venue?.lat : undefined,
      venueLng: hasGeo ? venue?.lng : undefined,
      venueGeoSource: hasGeo ? venue?.geoSource : undefined,
    };
  });
}
