import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { generateId } from '../../utils';

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

const BUCKET_NAME = process.env.EVENT_POSTERS_BUCKET || '';
const CDN_URL = process.env.EVENT_POSTERS_CDN_URL || '';
const PRESIGNED_URL_EXPIRY = 300; // 5 minutes

function extFromContentType(contentType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'application/pdf': '.pdf',
  };
  return map[contentType] ?? '.jpg';
}

export async function getUploadUrl(
  _fileName: string,
  contentType: string
): Promise<{ uploadId: string; uploadUrl: string; posterUrl: string }> {
  const uploadId = generateId();
  const key = `posters/${uploadId}${extFromContentType(contentType)}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(s3Client, command, {
    expiresIn: PRESIGNED_URL_EXPIRY,
  });

  const baseUrl = CDN_URL || `https://${BUCKET_NAME}.s3.amazonaws.com`;
  const posterUrl = `${baseUrl}/${key}`;

  return { uploadId, uploadUrl, posterUrl };
}

export async function uploadPosterFromUrl(
  imageUrl: string,
  contentType = 'image/jpeg'
): Promise<{ uploadId: string; posterUrl: string }> {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const uploadId = generateId();
  const key = `posters/${uploadId}${extFromContentType(contentType)}`;
  await s3Client.send(
    new PutObjectCommand({ Bucket: BUCKET_NAME, Key: key, ContentType: contentType, Body: buffer })
  );
  const baseUrl = CDN_URL || `https://${BUCKET_NAME}.s3.amazonaws.com`;
  return { uploadId, posterUrl: `${baseUrl}/${key}` };
}
