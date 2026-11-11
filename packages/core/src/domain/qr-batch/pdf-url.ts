import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PRESIGNED_URL_TTL_SEC } from '../venue-qr/constants';
import { qrBatchPdfKey } from './pdf-key';

export { qrBatchPdfKey };

/**
 * A 5 minute download link for a batch PDF in the private bucket. Authorises nothing: the caller
 * must already be a moderator. The key is checked against the `qr-batches/` prefix so a bad row
 * cannot be used to sign a read of another object.
 */
export async function getQrBatchPdfUrl(
  key: string,
  options: { bucket?: string; client?: S3Client } = {}
): Promise<string> {
  if (!key.startsWith('qr-batches/') || key.includes('..')) {
    throw new Error('Key is outside the qr-batches prefix');
  }
  const bucket = options.bucket ?? process.env.PRIVATE_FILES_BUCKET ?? '';
  const client = options.client ?? new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
  const name = key.split('/').pop() ?? 'qr-batch.pdf';
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${name}"`,
    }),
    { expiresIn: PRESIGNED_URL_TTL_SEC }
  );
}
