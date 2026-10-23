import table from './pin-centroids.json';

/**
 * PIN code → centroid, for "≈ 6 km from you" and for placing a venue that has only a PIN.
 * Built by `pnpm cli pin-centroids` from Nominatim (OpenStreetMap, ODbL); covers the PIN ranges
 * of the cities with venues on record. GeoNames was tried first and rejected: it puts Bengaluru
 * PINs at the district centroid, about 25 km out.
 */
export const PIN_CENTROIDS: Readonly<Record<string, readonly [number, number]>> = (
  table as unknown as { pins: Record<string, [number, number]> }
).pins;
const PINS = PIN_CENTROIDS;

export function pinCentroid(pin: string): { lat: number; lng: number } | null {
  const hit = PINS[pin.replace(/\s+/g, '')];
  return hit ? { lat: hit[0], lng: hit[1] } : null;
}

export function isPinCode(value: string): boolean {
  return /^[1-9]\d{5}$/.test(value.replace(/\s+/g, ''));
}
