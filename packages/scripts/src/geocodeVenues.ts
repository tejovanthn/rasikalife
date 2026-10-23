/**
 * Fills venue coordinates (and the city and PIN a PIN proves) from what each record holds.
 *
 * | Field                     | Source                                                     |
 * |---------------------------|------------------------------------------------------------|
 * | `lat`/`lng`, `map-link`   | the venue's `mapLink`, short links followed to the full URL |
 * | `lat`/`lng`, `postal-code`| the PIN centroid table (`core/src/shared/pin-centroids.json`) |
 * | `address.postalCode`      | a six-digit PIN already in the street line                 |
 * | `address.city`            | the PIN, for the ranges the table covers                   |
 *
 * The decisions are `planVenueGeo` (`domain/venue/geo.ts`, tested); this file only fetches and
 * prints. Empty fields are filled and filled ones never touched, so a rerun is a no-op.
 *
 * Usage: `pnpm prod-cli geocode-venues [--out venue-geo.csv]` (dry run), then `--apply`.
 */
import { writeFile } from 'node:fs/promises';
import { Venue } from '@rasika/core';
import { toCsv } from '@rasika/core/admin/csv';
import { PIN_CENTROIDS } from '@rasika/core/shared/pin-centroids';

const USER_AGENT = 'rasika.life geocode-venues (https://rasika.life)';

/** Follows a short map link's redirects by hand, since only the final URL holds coordinates. */
async function resolveMapLink(url: string): Promise<string | null> {
  let current = url;
  for (let hop = 0; hop < 5; hop++) {
    let res: Response;
    try {
      res = await fetch(current, { redirect: 'manual', headers: { 'User-Agent': USER_AGENT } });
    } catch {
      return null;
    }
    const next = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && next) {
      current = new URL(next, current).toString();
      continue;
    }
    return res.ok ? current : null;
  }
  return current;
}

async function listAllVenues() {
  const all: Venue.Venue[] = [];
  let nextToken: string | undefined;
  do {
    const page = await Venue.listVenues({ limit: 100, nextToken });
    all.push(...page.items);
    nextToken = page.nextToken;
  } while (nextToken);
  return all;
}

export async function geocodeVenues(opts: { apply?: boolean; out?: string }) {
  const pins = PIN_CENTROIDS;
  const venues = await listAllVenues();

  const rows: Array<Record<string, string>> = [];
  const changes: Array<{ id: string; patch: Venue.VenueGeoPatch }> = [];
  let deadLinks = 0;

  for (const venue of venues) {
    const hasGeo = typeof venue.lat === 'number' && typeof venue.lng === 'number';
    const resolved = !hasGeo && venue.mapLink ? await resolveMapLink(venue.mapLink) : null;
    if (venue.mapLink && !hasGeo && !resolved) deadLinks++;

    const patch = Venue.planVenueGeo(venue, pins, resolved);
    if (Object.keys(patch).length === 0) continue;
    changes.push({ id: venue.id, patch });
    rows.push({
      id: venue.id,
      name: venue.name,
      lat: patch.lat?.toString() ?? '',
      lng: patch.lng?.toString() ?? '',
      geo_source: patch.geoSource ?? '',
      city:
        patch.address?.city !== (venue.address?.city ?? undefined)
          ? (patch.address?.city ?? '')
          : '',
      postal_code:
        patch.address?.postalCode !== (venue.address?.postalCode ?? undefined)
          ? (patch.address?.postalCode ?? '')
          : '',
      street: venue.address?.street ?? '',
      map_link: venue.mapLink ?? '',
    });
  }

  const count = (key: string) => rows.filter(r => r[key]).length;
  console.log(`Scanned ${venues.length} venues; ${changes.length} to fill.`);
  console.log(
    `  coordinates: ${count('lat')} (map link ${rows.filter(r => r.geo_source === 'map-link').length}, PIN ${rows.filter(r => r.geo_source === 'postal-code').length})`
  );
  console.log(`  city: ${count('city')}, PIN code: ${count('postal_code')}`);
  if (deadLinks) console.log(`  ${deadLinks} map link(s) did not resolve.`);

  if (opts.out) {
    const header = rows.length ? Object.keys(rows[0]) : [];
    await writeFile(opts.out, toCsv([header, ...rows.map(row => header.map(key => row[key]))]));
    console.log(`Wrote ${opts.out}`);
  }

  if (!opts.apply) {
    console.log('Dry run. Pass --apply to write.');
    return;
  }

  let written = 0;
  for (const { id, patch } of changes) {
    try {
      await Venue.updateVenue(id, patch);
      written++;
    } catch (error) {
      console.error(`Failed ${id}:`, error);
    }
  }
  console.log(`Wrote ${written} of ${changes.length} venues.`);

  if (written > 0) {
    const { invalidateSiteCache } = await import('@rasika/core/site-cache');
    await invalidateSiteCache('cli geocode-venues');
  }
}
