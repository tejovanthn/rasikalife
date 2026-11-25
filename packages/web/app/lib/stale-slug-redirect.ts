// 301 an old slug to the current one. The page's own canonical tag is built by
// `generate<Type>Url(storedName, id)`; callers pass that exact string here, so the redirect
// target is always the canonical path and a request for it is never redirected again.

/** Decoded, NFC form of a path segment, or null when the encoding is broken. */
export function slugKey(segment: string): string | null {
  try {
    return decodeURIComponent(segment).normalize('NFC');
  } catch {
    return null;
  }
}

/**
 * `canonicalPath` is the entity's canonical path, e.g. `/carnatic/ragas/kapi-<id>`. Returns a
 * 301 when the request's slug segment differs from it, keeping any sub-path (`/compositions`)
 * and the query string; otherwise null.
 *
 * Only GET and HEAD are redirected: a POST to an old URL must reach its action. Slugs are
 * compared decoded and in NFC, so `%C4%81`, `%c4%81` and a literal `ā` are one slug, and a
 * proxy that re-encodes `( ) ! ~` cannot start a loop. The `.data` suffix and `_routes`
 * parameter of a client data request are removed before the target is built.
 */
export function staleSlugRedirect(request: Request, canonicalPath: string): Response | null {
  if (request.method !== 'GET' && request.method !== 'HEAD') return null;

  const cut = canonicalPath.lastIndexOf('/') + 1;
  const prefix = canonicalPath.slice(0, cut);
  const canonicalSegment = canonicalPath.slice(cut);

  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\.data$/, '');
  if (!pathname.startsWith(prefix)) return null;

  const rest = pathname.slice(prefix.length);
  const slash = rest.indexOf('/');
  const segment = slash === -1 ? rest : rest.slice(0, slash);
  let tail = slash === -1 ? '' : rest.slice(slash);
  if (tail === '/') tail = '';

  const requested = slugKey(segment);
  const wanted = slugKey(canonicalSegment);
  if (requested === null || wanted === null || requested === wanted) return null;

  const params = new URLSearchParams(url.search);
  params.delete('_routes');
  const search = params.toString();

  return new Response(null, {
    status: 301,
    headers: {
      Location: `${prefix}${canonicalSegment}${tail}${search ? `?${search}` : ''}`,
      // A rename can undo an earlier one. A browser that kept this redirect for good would
      // then loop between the two names, so it must ask again; the CDN may keep it briefly.
      'Cache-Control': 'public, max-age=0, s-maxage=60',
    },
  });
}
