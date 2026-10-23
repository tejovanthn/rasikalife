import { canonicalCitySlug } from '../../shared/city';
import type { VenueGeoSource } from './schema';

/**
 * Coordinates and city for a venue, from what its record already holds. Browser-safe and pure;
 * the network (following a short map link) is the script's job.
 *
 * The same rule as the other fills: an empty field is filled, a filled one is never touched,
 * so a rerun is a no-op and a moderator's correction survives.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

function valid(lat: number, lng: number): LatLng | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  // (0, 0) is a parse of nothing, not a hall in the Gulf of Guinea.
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}

/**
 * Reads coordinates out of a full Google Maps URL. The place's own pin (`!3d…!4d…`) wins over
 * the map's centre (`@lat,lng`), which is only where the viewer was looking. A short link
 * (`maps.app.goo.gl`) holds none; follow it first.
 */
export function parseMapLinkCoordinates(url: string): LatLng | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(url);
  } catch {
    decoded = url;
  }

  const pin = decoded.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (pin) return valid(Number(pin[1]), Number(pin[2]));

  const centre = decoded.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (centre) return valid(Number(centre[1]), Number(centre[2]));

  const query = decoded.match(
    /[?&](?:q|query|ll|destination)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/
  );
  if (query) return valid(Number(query[1]), Number(query[2]));

  return null;
}

/** A six-digit Indian PIN, from the postal code field or else the street line. */
export function venuePostalCode(address?: { postalCode?: string; street?: string } | null) {
  const stated = address?.postalCode?.replace(/\s+/g, '');
  if (stated && /^[1-9]\d{5}$/.test(stated)) return stated;
  // "560 003" is how a poster often prints it.
  const inStreet = address?.street?.match(/\b([1-9]\d{2})\s?(\d{3})\b/);
  return inStreet ? `${inStreet[1]}${inStreet[2]}` : undefined;
}

/**
 * The city a PIN belongs to, for the ranges the centroid table covers and nothing else. A PIN
 * outside them says nothing we can stand behind, so it fills nothing.
 */
const PIN_CITIES: ReadonlyArray<{ from: number; to: number; city: string }> = [
  { from: 560001, to: 560300, city: 'Bengaluru' },
  { from: 570001, to: 570035, city: 'Mysuru' },
  { from: 600001, to: 600130, city: 'Chennai' },
];

export function cityForPin(pin: string): string | undefined {
  const n = Number(pin);
  return PIN_CITIES.find(range => n >= range.from && n <= range.to)?.city;
}

export interface GeoVenue {
  lat?: number | null;
  lng?: number | null;
  city?: string | null;
  mapLink?: string | null;
  address?: { street?: string; city?: string; postalCode?: string } | null;
}

export interface VenueGeoPatch {
  lat?: number;
  lng?: number;
  geoSource?: VenueGeoSource;
  /** The whole address, so a write does not drop the parts it did not change. */
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
}

/**
 * What to fill on one venue. `resolvedMapUrl` is the map link after its redirects, when the
 * caller followed them; `pins` is the centroid table.
 */
export function planVenueGeo(
  venue: GeoVenue,
  pins: Readonly<Record<string, readonly [number, number]>>,
  resolvedMapUrl?: string | null
): VenueGeoPatch {
  const patch: VenueGeoPatch = {};
  const pin = venuePostalCode(venue.address);

  const hasGeo = typeof venue.lat === 'number' && typeof venue.lng === 'number';
  if (!hasGeo) {
    const fromLink = parseMapLinkCoordinates(resolvedMapUrl || venue.mapLink || '');
    // A stated city that disagrees with the PIN's means one of them is wrong; the PIN alone
    // cannot say which, so it places nothing.
    const stated = venue.address?.city || venue.city;
    const pinCity = pin ? cityForPin(pin) : undefined;
    const agrees = !stated || !pinCity || canonicalCitySlug(stated) === canonicalCitySlug(pinCity);
    const centroid = pin && agrees ? pins[pin] : undefined;
    if (fromLink) {
      Object.assign(patch, { ...fromLink, geoSource: 'map-link' as const });
    } else if (centroid) {
      Object.assign(patch, {
        lat: centroid[0],
        lng: centroid[1],
        geoSource: 'postal-code' as const,
      });
    }
  }

  const address = { ...(venue.address ?? {}) };
  let addressChanged = false;
  if (pin && !address.postalCode) {
    address.postalCode = pin;
    addressChanged = true;
  }
  const city = pin ? cityForPin(pin) : undefined;
  if (city && !address.city && !venue.city) {
    address.city = city;
    addressChanged = true;
  }
  if (addressChanged) patch.address = address;

  return patch;
}
