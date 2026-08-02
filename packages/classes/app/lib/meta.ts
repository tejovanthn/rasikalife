/**
 * The document head for every route.
 *
 * A `meta` export on a child route **replaces** the root's rather than merging with it, so a
 * route that set only a title would silently drop `noindex` from a page showing a child's
 * attendance record. Every route therefore goes through this, and the tags that must never be
 * absent live in one place rather than being remembered seven times.
 */
export function pageMeta(title?: string) {
  return [
    { title: title ? `${title} · Rasika Classes` : 'Rasika Classes' },
    // Belt. `robots.txt` on this origin is the braces, and neither is a permission system —
    // authorisation is enforced in tRPC on every request.
    { name: 'robots', content: 'noindex, nofollow, noarchive' },
    { name: 'theme-color', content: 'hsl(17, 100%, 95%)' },
    { name: 'apple-mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-title', content: 'Classes' },
    { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
  ];
}
