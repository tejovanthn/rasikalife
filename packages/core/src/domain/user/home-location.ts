import { isPinCode, pinCentroid } from '../../shared/pin-centroids';

/**
 * A reader's home location, as stored: never more precise than a PIN code. Browser-safe and
 * pure; `setHomeLocation` in `index.ts` is the writer.
 */
export interface HomeLocation {
  lat: number;
  lng: number;
  pin?: string;
  source: 'pin' | 'device';
}

export type HomeLocationInput = { pin: string } | { lat: number; lng: number };

export type HomeLocationResult =
  | { ok: true; location: HomeLocation }
  | { ok: false; reason: 'invalid-pin' | 'unknown-pin' | 'invalid-coordinates' };

/** Two decimals is about 1.1 km of latitude: enough for "≈ 6 km", too coarse to find a door. */
function coarse(n: number): number {
  return Math.round(n * 100) / 100;
}

export function resolveHomeLocation(input: HomeLocationInput): HomeLocationResult {
  if ('pin' in input) {
    const pin = input.pin.replace(/\s+/g, '');
    if (!isPinCode(pin)) return { ok: false, reason: 'invalid-pin' };
    const hit = pinCentroid(pin);
    if (!hit) return { ok: false, reason: 'unknown-pin' };
    return { ok: true, location: { ...hit, pin, source: 'pin' } };
  }
  const { lat, lng } = input;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return { ok: false, reason: 'invalid-coordinates' };
  }
  return { ok: true, location: { lat: coarse(lat), lng: coarse(lng), source: 'device' } };
}

/** What the reader is shown: "560004", or "your location". */
export function homeLocationLabel(location: HomeLocation): string {
  return location.pin ?? 'your location';
}
