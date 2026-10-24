/**
 * A venue's address, read off the poster of an event held there.
 *
 * The poster extractor has always asked the model for the hall's street, city, state and PIN,
 * and every one of them was dropped before the draft was written, so each venue a poster
 * introduced was created holding nothing but its name. In Oct 2026, 76 of 150 venues had no
 * city, and the fix was a person re-reading those posters by hand. The event now keeps the
 * address as printed (`event.venueAddress`), the verify step shows it, and approval copies it
 * onto a venue that has none (`cascadeEventAddressToVenue`). Pure and browser-safe.
 *
 * **The address is copied whole or not at all.** Two posters for one hall print it differently,
 * and a street from one beside a PIN from another is an address nobody wrote. So a venue that
 * holds any part of an address is never touched, which also keeps a moderator's correction and
 * makes approving a second event for the same hall a no-op.
 *
 * **A poster that disagrees with the record about the city seeds nothing.** That is the sign of
 * an event linked to the wrong venue rather than of a venue missing its address: the Oct 2026
 * pass found two Chennai concerts attached to Bengaluru venues of the same name, and copying
 * their posters would have moved both halls to Chennai.
 */

import { canonicalCitySlug } from '../../shared/city';
import { cityForPin } from './geo';

export interface VenueAddress {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

type RawAddress = { [K in keyof VenueAddress]?: string | null } | null | undefined;

const PARTS = ['street', 'city', 'state', 'postalCode', 'country'] as const;

/**
 * The address as a poster printed it, with every blank part dropped. The model returns `null`
 * for a part the poster does not state, and a nested `null` survives the shallow `stripNulls`
 * the event writes go through. A PIN printed as "560 061" is joined. `undefined` when nothing
 * is left.
 */
export function printedVenueAddress(raw: RawAddress): VenueAddress | undefined {
  if (!raw) return undefined;
  const address: VenueAddress = {};
  for (const part of PARTS) {
    const value = raw[part]?.trim();
    if (value) address[part] = value;
  }
  if (address.postalCode && /^\d{3}\s+\d{3}$/.test(address.postalCode)) {
    address.postalCode = address.postalCode.replace(/\s+/g, '');
  }
  return Object.keys(address).length ? address : undefined;
}

export interface VenueAddressSeed {
  address: VenueAddress;
  /** Set only when the venue had no `city`, which is what listings and city pages key on. */
  city?: string;
}

/**
 * What an approved event may write onto its venue: the poster's whole address, or nothing.
 *
 * Nothing when the venue already holds any address part, when the poster states no street, city
 * or PIN (a state alone places nothing), or when the city disagrees with the venue's own city
 * or with the city its PIN belongs to.
 */
export function venueAddressSeed(
  venue: { address?: VenueAddress | null; city?: string | null },
  printed: RawAddress
): VenueAddressSeed | undefined {
  const poster = printedVenueAddress(printed);
  if (!poster) return undefined;
  if (!poster.street && !poster.city && !poster.postalCode) return undefined;
  if (printedVenueAddress(venue.address)) return undefined;

  const storedCity = venue.city?.trim() || undefined;
  const pinCity = poster.postalCode ? cityForPin(poster.postalCode) : undefined;
  const cities = [storedCity, poster.city, pinCity].filter((c): c is string => !!c);
  if (new Set(cities.map(canonicalCitySlug)).size > 1) return undefined;

  // All three name one city by now, so take the spelling the corpus already uses: the venue's
  // own, then the PIN table's ("Bengaluru"), and only then the poster's ("Bangalore").
  const city = storedCity ?? pinCity ?? poster.city;
  return {
    address: { ...poster, ...(city ? { city } : {}) },
    ...(!storedCity && city ? { city } : {}),
  };
}
