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

function buildPosterKey(contentType: string): { uploadId: string; key: string; posterUrl: string } {
  const uploadId = generateId();
  const key = `posters/${uploadId}${EXTENSIONS[contentType] ?? '.jpg'}`;
  const posterUrl = `${CDN || `https://${BUCKET}.s3.amazonaws.com`}/${key}`;
  return { uploadId, key, posterUrl };
}

export async function getUploadUrl(
  _fileName: string,
  contentType: string
): Promise<{ uploadId: string; uploadUrl: string; posterUrl: string }> {
  const { uploadId, key, posterUrl } = buildPosterKey(contentType);
  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType }),
    { expiresIn: 300 }
  );
  return { uploadId, uploadUrl, posterUrl };
}

export async function uploadPosterFromBuffer(
  buffer: Buffer,
  contentType = 'image/jpeg'
): Promise<{ uploadId: string; posterUrl: string }> {
  const { uploadId, key, posterUrl } = buildPosterKey(contentType);
  await s3.send(
    new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType, Body: buffer })
  );
  return { uploadId, posterUrl };
}
