import type { LoaderFunction } from 'react-router';

export const loader: LoaderFunction = async () => {
  const robotsTxt = `
User-agent: *
Allow: /

# Sitemaps
Sitemap: https://rasika.life/sitemap.xml

# Disallow admin pages
Disallow: /carnatic/admin/

# Crawl-delay for politeness
Crawl-delay: 1

# Specific rules for search engines
User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /

User-agent: Slurp
Allow: /
`.trim();

  return new Response(robotsTxt, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
    },
  });
};
