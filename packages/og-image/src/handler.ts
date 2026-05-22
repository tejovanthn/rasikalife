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

export const handler: APIGatewayProxyHandlerV2 = async (
  event
): Promise<APIGatewayProxyResultV2> => {
  const { type, id } = parsePath(event);
  if (!type || !id) return notFound();

  const bucket = process.env.EVENT_POSTERS_BUCKET ?? '';
  const cdn = process.env.EVENT_POSTERS_CDN_URL ?? '';
  const cacheKey = `og-images/${type}/${id}.jpg`;
  const cdnUrl = `${cdn}/${cacheKey}`;

  // Fast path: redirect to the CDN if we've already cached this image
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: cacheKey }));
    return { statusCode: 302, headers: { Location: cdnUrl } };
  } catch {
    // Not cached — fall through and generate
  }

  const { title, subtitle, typeLabel } = await resolveEntity(type, id);
  const jpeg = await sharp(Buffer.from(buildSvg(title, subtitle, typeLabel)))
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

function parsePath(event: APIGatewayProxyEventV2): { type: OgType | null; id: string | null } {
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

async function resolveEntity(
  type: OgType,
  id: string
): Promise<{ title: string; subtitle: string; typeLabel: string }> {
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

function titleFontSize(title: string): number {
  if (title.length <= 20) return 80;
  if (title.length <= 35) return 64;
  if (title.length <= 50) return 52;
  return 40;
}

function buildSvg(title: string, subtitle: string, typeLabel: string): string {
  const safeTitle = escapeXml(title.length > 55 ? `${title.slice(0, 52)}…` : title);
  const safeSubtitle = escapeXml(subtitle);
  const safeTypeLabel = escapeXml(typeLabel);
  const fontSize = titleFontSize(title);
  const titleY = fontSize >= 72 ? 360 : 370;
  const subtitleY = titleY + fontSize * 0.9;

  return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#0f0a07"/>
  <rect x="0" y="0" width="6" height="630" fill="#e06030"/>
  <text x="48" y="72" font-family="DejaVu Sans,Arial,sans-serif" font-size="26" font-weight="bold" fill="#e06030">rasika.life</text>
  <rect x="48" y="240" width="${safeTypeLabel.length * 13 + 40}" height="38" rx="6" fill="#2a1208"/>
  <text x="68" y="266" font-family="DejaVu Sans,Arial,sans-serif" font-size="18" font-weight="600" fill="#e06030">${safeTypeLabel}</text>
  <text x="48" y="${titleY}" font-family="DejaVu Sans,Arial,sans-serif" font-size="${fontSize}" font-weight="bold" fill="#ffffff">${safeTitle}</text>
  <text x="48" y="${subtitleY}" font-family="DejaVu Sans,Arial,sans-serif" font-size="28" fill="#808080">${safeSubtitle}</text>
</svg>`;
}

function escapeXml(s: string): string {
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
