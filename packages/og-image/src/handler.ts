import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { AppRouter } from '@rasika/trpc';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { APIGatewayProxyHandlerV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import sharp from 'sharp';
import { CARD_HEIGHT, CARD_VERSION, PHOTO_PANEL_WIDTH, buildSvg, contentHash } from './card';
import type { OgType } from './request';
import { parsePath } from './request';

const s3 = new S3Client({});

const trpc = createTRPCClient<AppRouter>({
  links: [httpBatchLink({ url: process.env.TRPC_URL ?? '' })],
});

const PHOTO_FETCH_TIMEOUT_MS = 2500;
const PHOTO_MAX_BYTES = 5 * 1024 * 1024; // a portrait photo has no business being bigger

export const handler: APIGatewayProxyHandlerV2 = async (
  event
): Promise<APIGatewayProxyResultV2> => {
  const { type, id } = parsePath(event);
  if (!type || !id) return notFound();

  const bucket = process.env.EVENT_POSTERS_BUCKET ?? '';
  const cdn = process.env.EVENT_POSTERS_CDN_URL ?? '';

  // Content-keyed cache: the key folds in a hash of everything that changes the rendered card,
  // so a rename, a newly added photo, or a redesign (CARD_VERSION) lands on a fresh key instead
  // of the old immutable object serving stale content for a year. Old keys are orphaned in S3 —
  // acceptable, no cleanup job.
  // Cost: the entity must be resolved before we can HEAD, so even a cache hit spends one tRPC
  // query. That is real per-request cost on a crawler-heavy path, not free — the cheap fix is to
  // carry the hash in the URL so the page that already loaded the entity supplies it.
  const { title, subtitle, typeLabel, photoUrl } = await resolveEntity(type, id);
  const cacheKey = `og-images/${type}/${id}-${contentHash([CARD_VERSION, title, subtitle, photoUrl])}.jpg`;
  const cdnUrl = `${cdn}/${cacheKey}`;

  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: cacheKey }));
    return { statusCode: 302, headers: { Location: cdnUrl } };
  } catch {
    // Not cached — fall through and generate
  }

  const photoDataUri = photoUrl ? await resolvePhotoDataUri(photoUrl) : null;
  const jpeg = await sharp(Buffer.from(buildSvg(title, subtitle, typeLabel, photoDataUri)))
    .jpeg({ quality: 90 })
    .toBuffer();

  // A card that should have had a photo but didn't get one is degraded, not final: caching it
  // under a key derived from the unchanged photoUrl would freeze one transient timeout into a
  // year of photo-less shares that no retry could clear. Serve it, don't persist it. The
  // response header still gives the edge a day, so a flapping origin can't cause a render storm.
  const degraded = Boolean(photoUrl) && photoDataUri === null;
  if (!degraded) {
    // Fire-and-forget; we still serve the image even if S3 hiccups.
    s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: cacheKey,
        Body: jpeg,
        ContentType: 'image/jpeg',
        CacheControl: 'public, max-age=31536000, immutable',
      })
    ).catch((err: unknown) => console.error('[og] S3 put failed:', err));
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=86400' },
    isBase64Encoded: true,
    body: jpeg.toString('base64'),
  };
};

function notFound(): APIGatewayProxyResultV2 {
  return { statusCode: 404, body: 'Not Found' };
}

interface ResolvedEntity {
  title: string;
  subtitle: string;
  typeLabel: string;
  photoUrl?: string;
}

async function resolveEntity(type: OgType, id: string): Promise<ResolvedEntity> {
  try {
    if (type === 'raga') {
      const raga = await trpc.raga.get.query({ id });
      return {
        title: raga?.name ?? 'Unknown Raga',
        subtitle: 'Indian Classical Music',
        typeLabel: 'Raga',
      };
    }
    if (type === 'composition') {
      const comp = await trpc.composition.get.query({ id });
      return {
        title: comp?.title ?? 'Unknown Composition',
        subtitle: comp?.composer?.name ? `by ${comp.composer.name}` : 'Indian Classical Music',
        typeLabel: 'Composition',
      };
    }
    const artist = await trpc.artist.get.query({ id });
    return {
      title: artist?.name ?? 'Unknown Artist',
      subtitle: 'Indian Classical Music',
      typeLabel: 'Artist',
      photoUrl: artist?.photoUrl,
    };
  } catch (err) {
    console.error(`[og] entity lookup failed for ${type}/${id}:`, err);
    const labels: Record<OgType, string> = {
      raga: 'Raga',
      composition: 'Composition',
      artist: 'Artist',
    };
    return { title: 'Rasika.life', subtitle: 'Indian Classical Music', typeLabel: labels[type] };
  }
}

// images/artist/ photos never pass through the poster webp/OG-crop converter — infra/
// event-posters.ts scopes those S3 notifications to the posters/ prefix only — so there is no
// pre-optimized -og.jpg sibling to prefer. We fetch and resize the original every time, guarded
// against a slow, huge, or corrupt response since this is a remote URL on someone else's clock.
async function resolvePhotoDataUri(photoUrl: string): Promise<string | null> {
  try {
    const res = await fetch(photoUrl, { signal: AbortSignal.timeout(PHOTO_FETCH_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`fetch failed with status ${res.status}`);

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > PHOTO_MAX_BYTES) {
      throw new Error(`photo too large: ${buf.byteLength} bytes`);
    }

    const resized = await sharp(buf)
      .resize(PHOTO_PANEL_WIDTH, CARD_HEIGHT, { fit: 'cover' })
      .jpeg({ quality: 85 })
      .toBuffer();
    return `data:image/jpeg;base64,${resized.toString('base64')}`;
  } catch (err) {
    // A missing or broken photo is expected often enough not to be an error — the caller
    // degrades to the text-only card. Logged at warn so it stays greppable without paging.
    console.warn('[og] photo fetch/decode failed, using text-only card:', err);
    return null;
  }
}
