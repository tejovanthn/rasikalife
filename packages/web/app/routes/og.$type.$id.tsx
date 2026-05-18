import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { LoaderFunctionArgs } from 'react-router';
import { client } from '~/api.server';

const s3 = new S3Client({});
const BUCKET = process.env.EVENT_POSTERS_BUCKET ?? '';
const CDN = process.env.EVENT_POSTERS_CDN_URL ?? '';

const VALID_TYPES = ['raga', 'composition', 'artist'] as const;
type OgType = (typeof VALID_TYPES)[number];

export async function loader({ params }: LoaderFunctionArgs) {
  const { type, id } = params;

  if (!type || !id || !VALID_TYPES.includes(type as OgType)) {
    return new Response('Not Found', { status: 404 });
  }

  const ogType = type as OgType;
  const cacheKey = `og-images/${ogType}/${id}.jpg`;
  const cdnUrl = `${CDN}/${cacheKey}`;

  // Fast path: check S3 cache and redirect to CDN
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: cacheKey }));
    return new Response(null, { status: 302, headers: { Location: cdnUrl } });
  } catch {
    // Not cached yet — generate below
  }

  const { title, subtitle, typeLabel } = await resolveEntity(ogType, id);
  const svg = buildSvg(title, subtitle, typeLabel);
  const jpeg = await svgToJpeg(svg);

  // Cache in S3 (fire-and-forget errors — we'll still serve the image)
  s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: cacheKey,
      Body: jpeg,
      ContentType: 'image/jpeg',
      CacheControl: 'public, max-age=31536000, immutable',
    })
  ).catch((err: unknown) => console.error('[og] S3 put failed:', err));

  return new Response(new Uint8Array(jpeg), {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}

async function resolveEntity(
  type: OgType,
  id: string
): Promise<{ title: string; subtitle: string; typeLabel: string }> {
  try {
    if (type === 'raga') {
      const raga = await client.raga.get.query({ id });
      return {
        title: raga?.name ?? 'Unknown Raga',
        subtitle: 'Indian Classical Music',
        typeLabel: 'Raga',
      };
    }
    if (type === 'composition') {
      const comp = await client.composition.get.query({ id });
      return {
        title: comp?.title ?? 'Unknown Composition',
        subtitle: comp?.composer?.name ? `by ${comp.composer.name}` : 'Indian Classical Music',
        typeLabel: 'Composition',
      };
    }
    // artist
    const artist = await client.artist.get.query({ id });
    return {
      title: artist?.name ?? 'Unknown Artist',
      subtitle: 'Indian Classical Music',
      typeLabel: 'Artist',
    };
  } catch {
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

  // Vertical positions shift slightly with font size to keep content centered
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

async function svgToJpeg(svg: string): Promise<Buffer> {
  // Dynamic import so Sharp's native module doesn't affect the client bundle
  const sharp = (await import('sharp')).default;
  return sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toBuffer();
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
