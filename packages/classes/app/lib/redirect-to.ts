/**
 * Whether a `redirectTo` may be followed after sign-in.
 *
 * `value.startsWith('/')` looks like the whole check and is not: `//evil.com/phish` starts with a
 * slash and a browser resolves it against the current origin as **`https://evil.com/phish`**.
 * That made a genuine `classes.rasika.life` sign-in the last hop before a credential-harvesting
 * page — the worst shape an open redirect can take, because the victim watched a real Google
 * consent screen on the way.
 *
 * `\` is rejected too: some browsers normalise a backslash to a forward slash in the authority
 * position, so `/\evil.com` is the same attack with different typing.
 *
 * Only a path is ever allowed. There is no legitimate reason for this app to send somebody off
 * its own origin after sign-in.
 */
export function safeRedirectTo(value: string | null | undefined, fallback = '/'): string {
  if (!value || !value.startsWith('/')) {
    return fallback;
  }
  // Protocol-relative (`//host`) and the backslash variant (`/\host`).
  if (value.length > 1 && (value[1] === '/' || value[1] === '\\')) {
    return fallback;
  }
  return value;
}
