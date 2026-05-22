import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { generateId } from '../../utils';

const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const BUCKET = process.env.EVENT_POSTERS_BUCKET || '';
const CDN = process.env.EVENT_POSTERS_CDN_URL || '';

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
};

function buildPosterKey(contentType: string): {
  uploadId: string;
  key: string;
  posterUrl: string;
  posterOgUrl: string;
} {
  const uploadId = generateId();
  const key = `posters/${uploadId}${EXTENSIONS[contentType] ?? '.jpg'}`;
  const base = CDN || `https://${BUCKET}.s3.amazonaws.com`;
  const posterUrl = `${base}/${key}`;
  // Landscape 1200x630 crop created by the image-processor Lambda after upload
  const posterOgUrl = `${base}/posters/${uploadId}-og.jpg`;
  return { uploadId, key, posterUrl, posterOgUrl };
}

export async function getUploadUrl(
  _fileName: string,
  contentType: string
): Promise<{ uploadId: string; uploadUrl: string; posterUrl: string; posterOgUrl: string }> {
  const { uploadId, key, posterUrl, posterOgUrl } = buildPosterKey(contentType);
  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType }),
    { expiresIn: 300 }
  );
  return { uploadId, uploadUrl, posterUrl, posterOgUrl };
}

export async function uploadPosterFromBuffer(
  buffer: Buffer,
  contentType = 'image/jpeg'
): Promise<{ uploadId: string; posterUrl: string; posterOgUrl: string }> {
  const { uploadId, key, posterUrl, posterOgUrl } = buildPosterKey(contentType);
  await s3.send(
    new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType, Body: buffer })
  );
  return { uploadId, posterUrl, posterOgUrl };
}
