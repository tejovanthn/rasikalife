/**
 * Stores width and height on every ArtistPhoto that has none.
 *
 * They are optional on the entity and only written by the multi-select upload path, so every
 * photograph added before that has no dimensions. Two surfaces need them and both degrade
 * without: the gallery masonry sets `aspect-ratio` from them, so images shift as they load, and
 * the profile hero picks its lead frame by aspect, so it cannot tell a landscape shot from a
 * portrait one.
 *
 * The alternative was measuring in the browser on every view. Fixing the data once is cheaper
 * and it fixes both surfaces rather than the one that asked.
 *
 * Reads each image only as far as its header — `sharp().metadata()` does not decode pixels — so
 * this is bounded by network, not CPU.
 *
 * Usage: `pnpm cli backfill-photo-dimensions [--dry-run] [--artist <id>] [--force]`
 */
import { ArtistPhoto } from '@rasika/core';
import sharp from 'sharp';

const { ArtistPhotoEntity } = ArtistPhoto;

/** Enough for a header on any sane image; a hung CDN must not stall the whole run. */
const FETCH_TIMEOUT_MS = 15_000;

interface PhotoRow {
  artistId: string;
  id: string;
  imageUrl: string;
  width?: number;
  height?: number;
}

/**
 * One retry, because a cold CDN object times out on first touch and then serves instantly.
 *
 * Seen on the very first row of the first real run: without this, a single slow fetch left a
 * photograph unmeasured and the operator re-running the whole script to catch it.
 */
async function fetchWithRetry(url: string): Promise<Response> {
  try {
    return await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  } catch {
    return fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  }
}

async function measure(url: string): Promise<{ width: number; height: number } | null> {
  const response = await fetchWithRetry(url);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  const { width, height, orientation } = await sharp(
    Buffer.from(await response.arrayBuffer())
  ).metadata();

  if (!width || !height) return null;

  // EXIF orientations 5-8 mean the file is stored rotated a quarter turn, so the stored width is
  // the displayed height. Every browser honours this; storing the raw values would tell the
  // masonry a portrait photo is landscape and reserve the wrong box for it.
  const rotated = typeof orientation === 'number' && orientation >= 5 && orientation <= 8;
  return rotated ? { width: height, height: width } : { width, height };
}

export async function backfillPhotoDimensions(
  opts: { dryRun?: boolean; artistId?: string; force?: boolean } = {}
): Promise<void> {
  const { dryRun = false, artistId, force = false } = opts;

  // A scan, because ArtistPhoto has no global list index — it is keyed by artist on both the
  // primary and the byArtist GSI. Fine here: the table holds few photographs and this is a
  // one-off repair, not something on a request path.
  console.log('Scanning ArtistPhoto…');
  const result = await ArtistPhotoEntity.scan.go({ pages: 'all' });
  const all = (result.data as PhotoRow[]) || [];

  const candidates = all
    .filter(photo => (artistId ? photo.artistId === artistId : true))
    .filter(photo => force || !(photo.width && photo.height));

  console.log(`${all.length} photographs, ${candidates.length} to measure.\n`);
  if (candidates.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  let written = 0;
  let skipped = 0;
  let failed = 0;

  for (const [index, photo] of candidates.entries()) {
    const label = `[${index + 1}/${candidates.length}] ${photo.artistId}/${photo.id}`;

    try {
      const size = await measure(photo.imageUrl);
      if (!size) {
        console.warn(`${label}: no dimensions in the file, skipped`);
        skipped++;
        continue;
      }

      const ratio = (size.width / size.height).toFixed(2);
      const shape = size.width > size.height ? 'landscape' : 'portrait';
      console.log(
        `${label}: ${size.width}×${size.height} (${ratio}, ${shape})${dryRun ? ' [dry-run]' : ''}`
      );

      if (!dryRun) {
        // A narrow writer, not updateArtistPhoto: dimensions are a property of the file and are
        // deliberately absent from the update schema, so no form can claim a portrait is
        // landscape. Patching through the entity keeps the orderStr GSI derivation intact.
        await ArtistPhoto.setArtistPhotoDimensions(photo.artistId, photo.id, size);
      }
      written++;
    } catch (error) {
      // One unreachable image must not end the run — a deleted upload or an expired CDN object
      // is exactly the kind of row a backfill exists to walk past.
      failed++;
      console.error(`${label}: FAILED — ${error instanceof Error ? error.message : error}`);
    }
  }

  console.log(`\n${written} photographs ${dryRun ? 'would be' : ''} updated.`);
  if (skipped > 0) console.log(`${skipped} skipped: the file carried no dimensions.`);
  if (failed > 0) console.log(`${failed} failed: see the errors above.`);
  if (dryRun) console.log('\n[dry-run] Nothing was written.');
}
