import type { APIGatewayProxyEventV2 } from 'aws-lambda';

export const VALID_TYPES = ['raga', 'composition', 'artist'] as const;
export type OgType = (typeof VALID_TYPES)[number];

/**
 * Whether this Lambda may fetch a given photo URL.
 *
 * `/og/artist/{id}` is a public, unauthenticated Function URL, and `artist.photoUrl` is a
 * bare `z.string().url()` writable through the editor form, the moderator wizard and the
 * admin CSV import. Fetching it unconditionally means any anonymous request can make this
 * Lambda issue an arbitrary request from inside AWS — `http://169.254.169.254/...` for
 * instance metadata, or any VPC-internal address — and the warn/degrade branch makes the
 * outcome observable from outside.
 *
 * Every legitimate artist photo is uploaded through `Image.getImageUploadUrl('artist', …)`
 * into the same bucket the poster CDN fronts, so the allowlist is exactly one origin. An
 * https scheme is required with it: the CDN serves https, and permitting http would leave
 * plaintext requests to a host an attacker might influence via DNS.
 *
 * A URL that fails this is treated as *no photo* rather than as a failed fetch. That matters
 * for caching: a failed fetch is "degraded" and deliberately not cached, so a rejected URL
 * would re-render the card on every single request.
 */
export function isAllowedPhotoUrl(photoUrl: string, cdnUrl: string): boolean {
  if (!cdnUrl) return false;
  try {
    const photo = new URL(photoUrl);
    const cdn = new URL(cdnUrl);
    return photo.protocol === 'https:' && photo.host === cdn.host;
  } catch {
    // An unparseable URL is not a fetchable one.
    return false;
  }
}

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
