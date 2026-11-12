/**
 * The scanner's IP, read from request headers, for the per-IP scan limit (decisions.md 17).
 *
 * Order of trust:
 * 1. `x-rasika-client-ip`: set by the CloudFront viewer-request function from `event.viewer.ip`
 *    (`infra/site.ts`). The function overwrites any value the client sent, and a header added
 *    there is forwarded to the origin without joining the cache key.
 * 2. `CloudFront-Viewer-Address` (`ip:port`), if a policy ever forwards it.
 * 3. `X-Forwarded-For`, first entry. A client can write this one, so it is the weakest.
 *
 * Every function returns `undefined` when the value is not a plausible address. No address
 * means no limit.
 */

const V4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;
const V6 = /^[0-9a-f:.]+$/i;

function isAddress(value: string): boolean {
  if (V4.test(value)) return value.split('.').every(part => Number(part) <= 255);
  return V6.test(value) && value.includes(':') && value.length <= 45;
}

/** A bare address, or `[v6]`, or `[v6]:port`, or `v4:port`. No port is guessed for bare IPv6. */
export function parseIp(value: string | null | undefined): string | undefined {
  const raw = value?.trim();
  if (!raw) return undefined;
  const bracket = raw.match(/^\[([^\]]+)\](?::\d{1,5})?$/);
  if (bracket) return isAddress(bracket[1]) ? bracket[1].toLowerCase() : undefined;
  const v4Port = raw.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d{1,5}$/);
  if (v4Port) return isAddress(v4Port[1]) ? v4Port[1] : undefined;
  return isAddress(raw) ? raw.toLowerCase() : undefined;
}

/**
 * `CloudFront-Viewer-Address` always ends in `:port`: `203.0.113.9:5555`, or for IPv6 the
 * address followed by `:port` with no brackets (`2001:db8::1:5555`) or with them.
 */
export function parseViewerAddress(value: string | null | undefined): string | undefined {
  const raw = value?.trim();
  if (!raw) return undefined;
  if (raw.startsWith('[') || raw.includes('.')) return parseIp(raw);
  const last = raw.lastIndexOf(':');
  if (last <= 0) return undefined;
  const port = raw.slice(last + 1);
  if (!/^\d{1,5}$/.test(port)) return undefined;
  const address = raw.slice(0, last);
  return isAddress(address) ? address.toLowerCase() : undefined;
}

export function parseForwardedFor(value: string | null | undefined): string | undefined {
  return parseIp(value?.split(',')[0]);
}

export function clientIpFromHeaders(headers: Headers): string | undefined {
  return (
    parseIp(headers.get('x-rasika-client-ip')) ??
    parseViewerAddress(headers.get('cloudfront-viewer-address')) ??
    parseForwardedFor(headers.get('x-forwarded-for'))
  );
}
