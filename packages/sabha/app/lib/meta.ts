/**
 * The document head for every route. A child's `meta` export replaces the root's, so every route
 * goes through this and `noindex` is never dropped.
 */
export function pageMeta(title?: string) {
  return [
    { title: title ? `${title} · rasika.life` : 'rasika.life' },
    { name: 'robots', content: 'noindex, nofollow, noarchive' },
  ];
}
