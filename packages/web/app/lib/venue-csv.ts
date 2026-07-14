/**
 * Round-trippable CSV mapping for venues. Browser-safe: only depends on the
 * client-safe venue types and the generic `csv` helpers.
 *
 * Every venue maps to one row. The `id` column identifies existing venues on
 * re-import — rows with a known id update in place, rows with a blank id create
 * a new venue. Nested fields are flattened/encoded so a spreadsheet can edit them:
 *   - address    -> `address_*` columns
 *   - amenities  -> pipe-joined slugs, e.g. `ac|parking|green-room`
 *   - socialLinks-> pipe-joined `platform:url` pairs (split on the first colon)
 */
import type { UpdateVenueInput, Venue } from '@rasika/core/domain/venue/client';
import { parseCsv, toCsv } from './csv';

export const VENUE_CSV_HEADERS = [
  'id',
  'name',
  'address_street',
  'address_city',
  'address_state',
  'address_postalCode',
  'address_country',
  'mapLink',
  'description',
  'venueType',
  'capacity',
  'website',
  'phone',
  'email',
  'photoUrl',
  'amenities',
  'nearestTransit',
  'foundedYear',
  'socialLinks',
] as const;

/** A parsed CSV row ready to hand to the bulk-import mutation. */
export type VenueCsvRow = UpdateVenueInput & { id?: string };

export interface ParsedVenuesCsv {
  rows: VenueCsvRow[];
  errors: string[];
}

function encodeSocialLinks(links: Venue['socialLinks']): string {
  return (links ?? []).map(link => `${link.platform}:${link.url}`).join('|');
}

function venueToCells(venue: Venue): string[] {
  return [
    venue.id,
    venue.name,
    venue.address?.street ?? '',
    venue.address?.city ?? '',
    venue.address?.state ?? '',
    venue.address?.postalCode ?? '',
    venue.address?.country ?? '',
    venue.mapLink ?? '',
    venue.description ?? '',
    venue.venueType ?? '',
    venue.capacity != null ? String(venue.capacity) : '',
    venue.website ?? '',
    venue.phone ?? '',
    venue.email ?? '',
    venue.photoUrl ?? '',
    (venue.amenities ?? []).join('|'),
    venue.nearestTransit ?? '',
    venue.foundedYear != null ? String(venue.foundedYear) : '',
    encodeSocialLinks(venue.socialLinks),
  ];
}

export function venuesToCsv(venues: Venue[]): string {
  return toCsv([[...VENUE_CSV_HEADERS], ...venues.map(venueToCells)]);
}

function decodeSocialLinks(raw: string): { platform: string; url: string }[] {
  return raw
    .split('|')
    .map(pair => pair.trim())
    .filter(Boolean)
    .map(pair => {
      const colon = pair.indexOf(':');
      return {
        platform: pair.slice(0, colon).trim(),
        url: pair.slice(colon + 1).trim(),
      };
    })
    .filter(link => link.platform && link.url);
}

export function parseVenuesCsv(text: string): ParsedVenuesCsv {
  const table = parseCsv(text);
  if (table.length === 0) {
    return { rows: [], errors: ['The CSV is empty.'] };
  }

  const header = table[0].map(column => column.trim());
  const columnIndex = (name: string) => header.indexOf(name);
  if (columnIndex('name') === -1) {
    return { rows: [], errors: ['The CSV is missing the required "name" column.'] };
  }

  const rows: VenueCsvRow[] = [];
  const errors: string[] = [];

  for (let r = 1; r < table.length; r++) {
    const cells = table[r];
    if (cells.every(cell => cell.trim() === '')) continue;

    const lineNumber = r + 1;
    const cell = (name: string) => {
      const index = columnIndex(name);
      return index === -1 ? '' : (cells[index] ?? '').trim();
    };

    const id = cell('id');
    const name = cell('name');
    if (!id && !name) {
      errors.push(`Line ${lineNumber}: skipped — row needs an id or a name.`);
      continue;
    }

    const row: VenueCsvRow = {};
    if (id) row.id = id;
    if (name) row.name = name;

    const address = {
      street: cell('address_street') || undefined,
      city: cell('address_city') || undefined,
      state: cell('address_state') || undefined,
      postalCode: cell('address_postalCode') || undefined,
      country: cell('address_country') || undefined,
    };
    if (Object.values(address).some(Boolean)) row.address = address;

    const mapLink = cell('mapLink');
    if (mapLink) row.mapLink = mapLink;
    const description = cell('description');
    if (description) row.description = description;
    const venueType = cell('venueType');
    if (venueType) row.venueType = venueType as VenueCsvRow['venueType'];
    const website = cell('website');
    if (website) row.website = website;
    const phone = cell('phone');
    if (phone) row.phone = phone;
    const email = cell('email');
    if (email) row.email = email;
    const photoUrl = cell('photoUrl');
    if (photoUrl) row.photoUrl = photoUrl;
    const nearestTransit = cell('nearestTransit');
    if (nearestTransit) row.nearestTransit = nearestTransit;

    const capacity = cell('capacity');
    if (capacity) {
      const value = Number(capacity);
      if (Number.isFinite(value)) row.capacity = value;
      else errors.push(`Line ${lineNumber}: ignored non-numeric capacity "${capacity}".`);
    }

    const foundedYear = cell('foundedYear');
    if (foundedYear) {
      const value = Number(foundedYear);
      if (Number.isFinite(value)) row.foundedYear = value;
      else errors.push(`Line ${lineNumber}: ignored non-numeric foundedYear "${foundedYear}".`);
    }

    const amenities = cell('amenities');
    if (amenities) {
      row.amenities = amenities
        .split('|')
        .map(item => item.trim())
        .filter(Boolean) as VenueCsvRow['amenities'];
    }

    const socialLinks = cell('socialLinks');
    if (socialLinks) {
      // Platform slugs are validated against the enum server-side on import.
      row.socialLinks = decodeSocialLinks(socialLinks) as VenueCsvRow['socialLinks'];
    }

    rows.push(row);
  }

  return { rows, errors };
}
