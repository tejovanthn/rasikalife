import { createHash } from 'node:crypto';
import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { AppRouter } from '@rasika/trpc';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyHandlerV2,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import sharp from 'sharp';

const s3 = new S3Client({});

const VALID_TYPES = ['raga', 'composition', 'artist'] as const;
type OgType = (typeof VALID_TYPES)[number];

const trpc = createTRPCClient<AppRouter>({
  links: [httpBatchLink({ url: process.env.TRPC_URL ?? '' })],
});

// Right-hand photo panel geometry on the 1200x630 card.
const PHOTO_PANEL_WIDTH = 440;
const PHOTO_PANEL_X = 1200 - PHOTO_PANEL_WIDTH;

const PHOTO_FETCH_TIMEOUT_MS = 2500;
const PHOTO_MAX_BYTES = 5 * 1024 * 1024; // a portrait photo has no business being bigger

export const handler: APIGatewayProxyHandlerV2 = async (
  event
): Promise<APIGatewayProxyResultV2> => {
  const { type, id } = parsePath(event);
  if (!type || !id) return notFound();

  const bucket = process.env.EVENT_POSTERS_BUCKET ?? '';
  const cdn = process.env.EVENT_POSTERS_CDN_URL ?? '';

  // Content-keyed cache: the key folds in a hash of what the card actually renders (title,
  // subtitle, photoUrl), so a rename or a photo added/changed after the first render lands on
  // a fresh key instead of the old immutable object serving stale content for a year. Old keys
  // are simply orphaned in S3 — acceptable, no cleanup job.
  // Cost: we must resolve the entity before we can HEAD, so the fast path now spends one tRPC
  // query where it used to spend zero. Still far cheaper than the Sharp render it's guarding.
  const { title, subtitle, typeLabel, photoUrl } = await resolveEntity(type, id);
  const cacheKey = `og-images/${type}/${id}-${contentHash([title, subtitle, photoUrl])}.jpg`;
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

  // Cache for next time. Fire-and-forget; we still serve the image even if S3 hiccups.
  s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: cacheKey,
      Body: jpeg,
      ContentType: 'image/jpeg',
      CacheControl: 'public, max-age=31536000, immutable',
    })
  ).catch((err: unknown) => console.error('[og] S3 put failed:', err));

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=86400' },
    isBase64Encoded: true,
    body: jpeg.toString('base64'),
  };
};

export function parsePath(event: APIGatewayProxyEventV2): {
  type: OgType | null;
  id: string | null;
} {
  // Function URLs invoke with the raw path; we accept both `/og/{type}/{id}` and `/{type}/{id}`
  const segments = event.rawPath.split('/').filter(Boolean);
  const ogIdx = segments.indexOf('og');
  const [type, id] = ogIdx >= 0 ? segments.slice(ogIdx + 1) : segments;
  if (!type || !id) return { type: null, id: null };
  return VALID_TYPES.includes(type as OgType) ? { type: type as OgType, id } : { type: null, id };
}

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

// Short, stable digest of the fields the card renders. Not a security hash — just enough
// entropy to change the cache key when the content changes.
export function contentHash(parts: readonly (string | undefined)[]): string {
  const hash = createHash('sha256');
  for (const part of parts) hash.update(part ?? '');
  return hash.digest('hex').slice(0, 12);
}

// images/artist/ photos never pass through the poster webp/OG-crop converter — infra/
// event-posters.ts scopes those S3 notifications to the posters/ prefix only — so there is no
// pre-optimized -og.jpg sibling to prefer. We fetch and resize the original every time, guarded
// against a slow, huge, or corrupt response since this is a remote URL on someone else's clock.
async function resolvePhotoDataUri(photoUrl: string): Promise<string | null> {
  try {
    const res = await fetch(photoUrl, { signal: AbortSignal.timeout(PHOTO_FETCH_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`fetch failed with status ${res.status}`);

    const contentLength = Number(res.headers.get('content-length') ?? '0');
    if (contentLength > PHOTO_MAX_BYTES) {
      throw new Error(`photo too large: ${contentLength} bytes`);
    }

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > PHOTO_MAX_BYTES) {
      throw new Error(`photo too large: ${buf.byteLength} bytes`);
    }

    const resized = await sharp(buf)
      .resize(PHOTO_PANEL_WIDTH, 630, { fit: 'cover' })
      .jpeg({ quality: 85 })
      .toBuffer();
    return `data:image/jpeg;base64,${resized.toString('base64')}`;
  } catch (err) {
    // A missing or broken photo is normal, not an error — fall through to the text-only card.
    console.error('[og] photo fetch/decode failed, using text-only card:', err);
    return null;
  }
}

const TITLE_TRUNCATE_LENGTH = 55;
const TITLE_TRUNCATE_LENGTH_WITH_PHOTO = 40;

export function titleFontSize(title: string, hasPhoto: boolean): number {
  // The photo panel narrows the available text column, so long titles need to start
  // shrinking sooner than the no-photo ladder does.
  if (hasPhoto) {
    if (title.length <= 14) return 72;
    if (title.length <= 24) return 56;
    if (title.length <= 34) return 44;
    return 34;
  }
  if (title.length <= 20) return 80;
  if (title.length <= 35) return 64;
  if (title.length <= 50) return 52;
  return 40;
}

export function buildSvg(
  title: string,
  subtitle: string,
  typeLabel: string,
  photoDataUri?: string | null
): string {
  const hasPhoto = Boolean(photoDataUri);
  const truncateAt = hasPhoto ? TITLE_TRUNCATE_LENGTH_WITH_PHOTO : TITLE_TRUNCATE_LENGTH;
  const safeTitle = escapeXml(
    title.length > truncateAt ? `${title.slice(0, truncateAt - 3)}…` : title
  );
  const safeSubtitle = escapeXml(subtitle);
  const safeTypeLabel = escapeXml(typeLabel);
  const fontSize = titleFontSize(title, hasPhoto);
  const titleY = fontSize >= 72 ? 360 : 370;
  const subtitleY = titleY + fontSize * 0.9;

  const photoMarkup = photoDataUri
    ? `
  <rect x="${PHOTO_PANEL_X - 4}" y="0" width="4" height="630" fill="#2a1208"/>
  <image x="${PHOTO_PANEL_X}" y="0" width="${PHOTO_PANEL_WIDTH}" height="630" href="${photoDataUri}" preserveAspectRatio="xMidYMid slice"/>`
    : '';

  return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#0f0a07"/>
  <rect x="0" y="0" width="6" height="630" fill="#e06030"/>
  <text x="48" y="72" font-family="DejaVu Sans,Arial,sans-serif" font-size="26" font-weight="bold" fill="#e06030">rasika.life</text>
  <rect x="48" y="240" width="${safeTypeLabel.length * 13 + 40}" height="38" rx="6" fill="#2a1208"/>
  <text x="68" y="266" font-family="DejaVu Sans,Arial,sans-serif" font-size="18" font-weight="600" fill="#e06030">${safeTypeLabel}</text>
  <text x="48" y="${titleY}" font-family="DejaVu Sans,Arial,sans-serif" font-size="${fontSize}" font-weight="bold" fill="#ffffff">${safeTitle}</text>
  <text x="48" y="${subtitleY}" font-family="DejaVu Sans,Arial,sans-serif" font-size="28" fill="#808080">${safeSubtitle}</text>${photoMarkup}
</svg>`;
}

export function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, c => {
    switch (c) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case "'":
        return '&#39;';
      case '"':
        return '&quot;';
      default:
        return c;
    }
  });
}
