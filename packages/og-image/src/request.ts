import type { APIGatewayProxyEventV2 } from 'aws-lambda';

export const VALID_TYPES = ['raga', 'composition', 'artist'] as const;
export type OgType = (typeof VALID_TYPES)[number];

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
