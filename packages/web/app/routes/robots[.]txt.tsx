import type { LoaderFunction } from 'react-router';

export const loader: LoaderFunction = async () => {
  const robotsTxt = `
User-agent: *
Allow: /

# Sitemaps
Sitemap: https://rasika.life/sitemap.xml

# Disallow private/utility pages
Disallow: /auth/
Disallow: /moderator/
Disallow: /my-edits
Disallow: /api/
Disallow: /events/new$
Disallow: /events/new/
Disallow: /*edit
`.trim();

  return new Response(robotsTxt, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
    },
  });
};
