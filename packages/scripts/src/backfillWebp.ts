import {
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import sharp from 'sharp';

const s3 = new S3Client({});

// Process at most this many images concurrently
const CONCURRENCY = 5;

interface BackfillOptions {
  dryRun?: boolean;
  prefix?: string;
}

interface Stats {
  scanned: number;
  skipped: number;
  converted: number;
  failed: number;
}

async function webpExists(bucket: string, key: string): Promise<boolean> {
  const webpKey = key.replace(/\.(jpe?g|png)$/i, '.webp');
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: webpKey }));
    return true;
  } catch {
    return false;
  }
}

async function convertOne(
  bucket: string,
  key: string,
  dryRun: boolean,
  stats: Stats
): Promise<void> {
  stats.scanned++;

  const alreadyDone = await webpExists(bucket, key);
  if (alreadyDone) {
    stats.skipped++;
    return;
  }

  const webpKey = key.replace(/\.(jpe?g|png)$/i, '.webp');

  if (dryRun) {
    console.log(`  [dry-run] would convert: ${key} → ${webpKey}`);
    stats.converted++;
    return;
  }

  let body: Uint8Array;
  try {
    const result = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if (!result.Body) throw new Error('Empty body');
    body = await result.Body.transformToByteArray();
  } catch (err) {
    console.error(`  [error] failed to download ${key}:`, err);
    stats.failed++;
    return;
  }

  let webpBuffer: Buffer;
  try {
    webpBuffer = await sharp(Buffer.from(body)).webp({ quality: 82, effort: 4 }).toBuffer();
  } catch (err) {
    console.error(`  [error] sharp failed for ${key}:`, err);
    stats.failed++;
    return;
  }

  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: webpKey,
        Body: webpBuffer,
        ContentType: 'image/webp',
        CacheControl: 'public, max-age=31536000, immutable',
      })
    );
  } catch (err) {
    console.error(`  [error] failed to upload ${webpKey}:`, err);
    stats.failed++;
    return;
  }

  const originalKb = Math.round(body.byteLength / 1024);
  const webpKb = Math.round(webpBuffer.byteLength / 1024);
  const saving = Math.round((1 - webpBuffer.byteLength / body.byteLength) * 100);
  console.log(`  ✓ ${key} → ${webpKey} (${originalKb}KB → ${webpKb}KB, ${saving}% smaller)`);
  stats.converted++;
}

export async function backfillWebp({ dryRun = false, prefix = 'posters/' }: BackfillOptions = {}) {
  const { Resource } = await import('sst');
  const bucket = Resource.EventPosters.name;

  console.log(`Backfilling WebP images in s3://${bucket}/${prefix}${dryRun ? ' [DRY RUN]' : ''}`);

  const stats: Stats = { scanned: 0, skipped: 0, converted: 0, failed: 0 };
  const imagePattern = /\.(jpe?g|png)$/i;

  let continuationToken: string | undefined;
  let pageNum = 0;

  do {
    const response = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    );

    const imageKeys = (response.Contents ?? [])
      .map(obj => obj.Key ?? '')
      .filter(key => imagePattern.test(key));

    if (imageKeys.length > 0) {
      pageNum++;
      console.log(`\nPage ${pageNum}: ${imageKeys.length} image(s) to check...`);

      // Process in batches of CONCURRENCY
      for (let i = 0; i < imageKeys.length; i += CONCURRENCY) {
        const batch = imageKeys.slice(i, i + CONCURRENCY);
        await Promise.all(batch.map(key => convertOne(bucket, key, dryRun, stats)));
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  console.log(`
Done!
  Scanned:   ${stats.scanned}
  Skipped:   ${stats.skipped} (WebP already exists)
  Converted: ${stats.converted}
  Failed:    ${stats.failed}
  `);
}
