import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { generateId } from '../../utils';

/**
 * Presigned upload and download for objects that must never be publicly readable.
 *
 * The sibling of `s3.ts`, and separate from it on purpose. `getImageUploadUrl` writes to
 * `EVENT_POSTERS_BUCKET`, which is `public: true` and fronted by a CloudFront distribution, and
 * it returns a permanent CDN URL that the caller stores. That is exactly right for a concert
 * poster and exactly wrong for a payment screenshot: an object key is not a secret, so anything
 * reachable without a signature is public whether or not anyone links to it.
 *
 * The differences are the whole point, and none of them should be smoothed away later:
 *
 *   - A different bucket, with no public access and no CDN in front of it.
 *   - Upload returns a **key**, not a URL. There is nothing to store that would work on its own.
 *   - Download is a separate call, signed for minutes, made only after the caller has run its
 *     own access check. `getPrivateDownloadUrl` does not authorise anything — it cannot, it has
 *     no idea who is asking. `classes.packScreenshotUrl` is where that happens.
 */
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

const BUCKET_NAME = process.env.CLASS_UPLOADS_BUCKET || '';

/** Long enough to upload a photo from a phone on a bad connection. */
const UPLOAD_URL_EXPIRY = 300;

/**
 * Short. A download URL needs to survive being put in an `<img src>` and fetched once; anything
 * longer is a link that outlives the check that produced it, and these get shared over WhatsApp.
 */
const DOWNLOAD_URL_EXPIRY = 120;

const ALLOWED_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf',
]);

/** Namespaced so a second private consumer cannot collide with class uploads. */
export type PrivateUploadNamespace = 'classes';

export function isAllowedPrivateContentType(contentType: string): boolean {
  return ALLOWED_CONTENT_TYPES.has(contentType.toLowerCase());
}

/**
 * A filename arrives from a browser and lands in an S3 key.
 *
 * `..` in a key does not escape a bucket the way it escapes a directory, but it does produce
 * keys that no longer sit under the prefix the caller believes they do, which quietly breaks any
 * future prefix-scoped policy or lifecycle rule. Strip to something boring instead.
 */
export function safeFileName(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? '';
  const cleaned = base.replace(/[^A-Za-z0-9._-]/g, '-').replace(/^[.-]+/, '');
  return cleaned.slice(0, 100) || 'upload';
}

export async function getPrivateUploadUrl(
  namespace: PrivateUploadNamespace,
  fileName: string,
  contentType: string
): Promise<{ uploadId: string; uploadUrl: string; key: string }> {
  if (!isAllowedPrivateContentType(contentType)) {
    throw new Error(`Unsupported content type: ${contentType}`);
  }

  const uploadId = generateId();
  const key = `private/${namespace}/${uploadId}/${safeFileName(fileName)}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: UPLOAD_URL_EXPIRY });

  // No `imageUrl`. There is no URL that works without a signature, which is the point.
  return { uploadId, uploadUrl, key };
}

/**
 * Signs a read. **Authorises nothing** — the caller must have already decided this viewer may
 * see this object.
 *
 * The prefix check is a backstop, not the access control: it stops a caller passing an
 * arbitrary key and getting back a signature for someone else's namespace.
 */
export async function getPrivateDownloadUrl(
  namespace: PrivateUploadNamespace,
  key: string
): Promise<string> {
  const prefix = `private/${namespace}/`;
  if (!key.startsWith(prefix)) {
    throw new Error(`Key is outside the ${namespace} namespace`);
  }

  const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key });
  return getSignedUrl(s3Client, command, { expiresIn: DOWNLOAD_URL_EXPIRY });
}
