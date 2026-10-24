import { createHash } from 'node:crypto';

/**
 * The rules for short links, kept free of the database so they can be tested alone.
 *
 * Codes are lowercase base36. ElectroDB lowercases key values, so a mixed-case code would
 * collide with its lowercase twin; lowercase is also easier to read aloud or retype from a
 * phone screen.
 */

export const SHORT_LINK_PREFIX = '/l/';
export const SHORT_CODE_LENGTH = 7;
export const SHORT_CODE_MAX_LENGTH = 12;
export const SHORT_CODE = /^[0-9a-z]{7,12}$/;

/**
 * The code for a target: the first `length` base36 digits of its SHA-256. Deterministic, so
 * building the same WhatsApp text twice writes nothing new. A longer `length` is the way
 * round the rare collision.
 */
export function shortLinkCode(target: string, length = SHORT_CODE_LENGTH): string {
  const digest = createHash('sha256').update(target).digest();
  let n = BigInt(`0x${digest.subarray(0, 16).toString('hex')}`);
  let code = '';
  while (code.length < length) {
    code += (n % 36n).toString(36);
    n /= 36n;
  }
  return code;
}

/**
 * Query keys a target may carry: the UTM tags and the listing's own filters
 * (`readListingState`). Anything else is refused, so the mutation that creates links cannot
 * be used to mint short links for arbitrary query strings.
 */
const ALLOWED_QUERY_KEYS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'when',
  'free',
  'view',
  'cast',
  'links',
  'sort',
  'cal',
]);

const PATH = /^\/[A-Za-z0-9\-._~%/]*$/;
const MAX_TARGET_LENGTH = 512;

/**
 * Whether `target` may be stored: a path on this site, never an origin (so `/l/` cannot
 * become an open redirect), with only known query keys, and never another short link.
 */
export function isShortLinkTarget(target: string): boolean {
  if (target.length > MAX_TARGET_LENGTH) return false;
  if (!target.startsWith('/') || target.startsWith('//')) return false;
  const [path, query = '', ...rest] = target.split('?');
  if (rest.length > 0 || target.includes('#')) return false;
  if (!path || !PATH.test(path) || path.includes('//')) return false;
  if (path.startsWith(SHORT_LINK_PREFIX)) return false;
  const params = new URLSearchParams(query);
  for (const key of params.keys()) {
    if (!ALLOWED_QUERY_KEYS.has(key)) return false;
  }
  return true;
}
