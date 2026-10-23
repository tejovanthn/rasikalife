/**
 * Straight-line distance for "≈ 6 km" on the event listings. Browser-only in use, but pure,
 * so it is tested in node.
 *
 * Straight-line on purpose: a road distance needs a routing service per reader, and the
 * figure is there to tell Malleswaram from Electronic City, not to plan the drive.
 */

export interface Point {
  lat: number;
  lng: number;
}

const EARTH_KM = 6371;

export function distanceKm(a: Point, b: Point): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(h));
}

/**
 * "≈ 6 km", "≈ 800 m". Whole kilometres past ten and halves below, since a PIN centroid can be
 * a kilometre or two out and a decimal would claim a precision nobody has.
 */
export function formatDistance(km: number): string {
  if (km < 1) return `≈ ${Math.max(100, Math.round(km * 10) * 100)} m`;
  if (km < 10) return `≈ ${Math.round(km * 2) / 2} km`;
  return `≈ ${Math.round(km)} km`;
}

export function isPin(value: string): boolean {
  return /^[1-9]\d{5}$/.test(value.replace(/\s+/g, ''));
}
