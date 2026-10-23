/**
 * A path on this site to send a reader back to after sign-in or a form, or `null`. Only a
 * leading single slash passes: `//evil.example` and `https://…` are how an open redirect is
 * built, and a login that bounces anywhere it is told to is one.
 */
export function safeRedirectPath(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return null;
  return value;
}
