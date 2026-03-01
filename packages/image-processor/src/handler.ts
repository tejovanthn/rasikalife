import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { GetObjectCommandOutput } from '@aws-sdk/client-s3';
import type { S3Event, S3Handler } from 'aws-lambda';
import sharp from 'sharp';

const s3 = new S3Client({});

export const handler: S3Handler = async (event: S3Event) => {
  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

    console.log(`[image-processor] Processing: s3://${bucket}/${key}`);

    // Get the original object
    let getResult: GetObjectCommandOutput;
    try {
      getResult = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    } catch (err) {
      console.error(`[image-processor] Failed to get object ${key}:`, err);
      continue;
    }

    const contentType = getResult.ContentType || '';

    // Skip non-image content types (e.g. PDFs)
    if (!contentType.startsWith('image/')) {
      console.log(`[image-processor] Skipping non-image content type: ${contentType}`);
      continue;
    }

    // Read body
    if (!getResult.Body) {
      console.error(`[image-processor] No body for ${key}`);
      continue;
    }

    const inputBuffer = Buffer.from(await getResult.Body.transformToByteArray());
    const originalSize = inputBuffer.byteLength;

    // Convert to WebP
    let webpBuffer: Buffer;
    try {
      webpBuffer = await sharp(inputBuffer).webp({ quality: 82, effort: 4 }).toBuffer();
    } catch (err) {
      console.error(`[image-processor] Sharp conversion failed for ${key}:`, err);
      continue;
    }

    // Write WebP sibling (replace extension with .webp)
    const webpKey = key.replace(/\.(jpe?g|png)$/i, '.webp');

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
      console.error(`[image-processor] Failed to put WebP object ${webpKey}:`, err);
      continue;
    }

    console.log(
      `[image-processor] Converted ${key} → ${webpKey}: ${originalSize} bytes → ${webpBuffer.byteLength} bytes (${Math.round((1 - webpBuffer.byteLength / originalSize) * 100)}% reduction)`
    );
  }
};
