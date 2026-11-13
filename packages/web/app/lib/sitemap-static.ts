export interface StaticSitemapPage {
  path: string;
  changefreq: string;
  priority: number;
}

/** The fixed pages of `sitemap-static.xml`. City and date pages are added by the route. */
export const STATIC_SITEMAP_PAGES: StaticSitemapPage[] = [
  { path: '/', changefreq: 'weekly', priority: 1.0 },
  { path: '/classes', changefreq: 'monthly', priority: 0.8 },
  { path: '/for-sabhas', changefreq: 'monthly', priority: 0.6 },
  { path: '/artists', changefreq: 'daily', priority: 0.8 },
  { path: '/events', changefreq: 'daily', priority: 0.8 },
  { path: '/venues', changefreq: 'weekly', priority: 0.7 },
  { path: '/organisers', changefreq: 'weekly', priority: 0.7 },
  { path: '/festivals', changefreq: 'weekly', priority: 0.7 },
  { path: '/carnatic', changefreq: 'weekly', priority: 0.8 },
  { path: '/carnatic/compositions', changefreq: 'weekly', priority: 0.7 },
  { path: '/carnatic/ragas', changefreq: 'weekly', priority: 0.7 },
  { path: '/carnatic/ragas/melakarta', changefreq: 'monthly', priority: 0.7 },
  { path: '/carnatic/ragas/janya', changefreq: 'monthly', priority: 0.6 },
  { path: '/carnatic/compositions/varnams', changefreq: 'monthly', priority: 0.6 },
  { path: '/carnatic/talas', changefreq: 'monthly', priority: 0.6 },
  { path: '/carnatic/languages', changefreq: 'monthly', priority: 0.6 },
];
