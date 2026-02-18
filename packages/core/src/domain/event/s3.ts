import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { generateId } from '../../utils';

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

const BUCKET_NAME = process.env.EVENT_POSTERS_BUCKET || '';
const PRESIGNED_URL_EXPIRY = 300; // 5 minutes

export async function getUploadUrl(
  fileName: string,
  contentType: string
): Promise<{ uploadId: string; uploadUrl: string; posterUrl: string }> {
  const uploadId = generateId();
  const key = `posters/${uploadId}/${fileName}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(s3Client, command, {
    expiresIn: PRESIGNED_URL_EXPIRY,
  });

  const posterUrl = `https://${BUCKET_NAME}.s3.amazonaws.com/${key}`;

  return { uploadId, uploadUrl, posterUrl };
}
