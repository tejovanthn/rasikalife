import { readFile, writeFile } from 'node:fs/promises';

/**
 * Builds the PIN-code centroid table the events page uses for "≈ 6 km from you"
 * (packages/core/src/shared/pin-centroids.json). Run once and commit the file; rerun only to add a
 * range. Nothing here touches the database.
 *
 * Nominatim (OpenStreetMap), not GeoNames: GeoNames puts Bengaluru PINs at the district
 * centroid (560003 Malleswaram lands about 25 km north), which is useless for a distance.
 * Nominatim's usage policy allows one request a second with an identifying User-Agent, so the
 * run is slow on purpose. The data is ODbL; the file carries the attribution.
 */

const DEFAULT_RANGES = [
  // Bengaluru, Mysuru, Chennai: the cities with venues on record.
  [560001, 560300],
  [570001, 570035],
  [600001, 600130],
] as const;

const USER_AGENT = 'rasika.life pin-centroids (https://rasika.life)';
const DELAY_MS = 1100;

type Table = Record<string, [number, number]>;

interface PinFile {
  source: string;
  pins: Table;
}

async function lookup(pin: string): Promise<[number, number] | null> {
  const url = `https://nominatim.openstreetmap.org/search?postalcode=${pin}&country=in&format=json&limit=1`;
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`Nominatim ${res.status} for ${pin}`);
  const hits = (await res.json()) as Array<{ lat: string; lon: string }>;
  if (hits.length === 0) return null;
  const round = (n: string) => Math.round(Number(n) * 10_000) / 10_000;
  return [round(hits[0].lat), round(hits[0].lon)];
}

export async function buildPinCentroids(opts: { out: string; ranges?: string }) {
  const ranges = opts.ranges
    ? opts.ranges.split(',').map(r => r.split('-').map(Number) as [number, number])
    : DEFAULT_RANGES;

  // Resume from an existing file, so an interrupted run does not start again.
  let pins: Table = {};
  try {
    pins = (JSON.parse(await readFile(opts.out, 'utf8')) as PinFile).pins;
  } catch {
    // No file yet.
  }

  for (const [from, to] of ranges) {
    for (let n = from; n <= to; n++) {
      const pin = String(n);
      if (pins[pin]) continue;
      const hit = await lookup(pin);
      if (hit) {
        pins[pin] = hit;
        console.log(pin, hit.join(','));
      }
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }
  }

  const sorted = Object.fromEntries(Object.entries(pins).sort(([a], [b]) => a.localeCompare(b)));
  const file: PinFile = {
    source: '© OpenStreetMap contributors, ODbL. Nominatim postal-code centroids.',
    pins: sorted,
  };
  await writeFile(opts.out, `${JSON.stringify(file)}\n`);
  console.log(`Wrote ${Object.keys(sorted).length} PIN centroids to ${opts.out}`);
}
