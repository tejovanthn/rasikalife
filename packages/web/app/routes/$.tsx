import { type LoaderFunctionArgs, json, type MetaFunction } from '@remix-run/node';
import { useLoaderData, Link } from '@remix-run/react';
import Markdown from 'react-markdown';
import type { SitemapFunction } from 'remix-sitemap';
import { serverOnly$ } from 'vite-env-only/macros';
import { client } from '~/api.server';

export const sitemap: SitemapFunction = serverOnly$(async () => {
  const list: { loc: string; lastmod: string }[] = [];
  const allPaths = await client.content.allPaths.query();

  allPaths.data.forEach(({ path, updatedAt }) => {
    list.push({
      loc: path,
      lastmod: new Date(updatedAt).toISOString(),
    });
  });

  return list;
});

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  const response = await client.content.byPath.query({ path: url.pathname });
  if (!response.data) {
    throw new Response(null, {
      status: 404,
      statusText: 'Not Found',
    });
  }

  return json({ contentData: response.data });
};

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data?.contentData) {
    return [
      { title: 'Page Not Found' },
      { name: 'description', content: 'The page you are looking for does not exist.' },
    ];
  }

  const { meta: contentMeta, path } = data.contentData;
  
  const metaTags = [
    { title: contentMeta?.title || 'Rasika.life' },
    { name: 'description', content: contentMeta?.description || 'Carnatic music resource' },
  ];

  if (contentMeta?.keywords?.length) {
    metaTags.push({ name: 'keywords', content: contentMeta.keywords.join(', ') });
  }

  if (contentMeta?.robots) {
    metaTags.push({ name: 'robots', content: contentMeta.robots });
  }

  if (contentMeta?.canonical) {
    metaTags.push({ tagName: 'link', rel: 'canonical', href: contentMeta.canonical });
  }

  // Open Graph tags
  if (contentMeta?.ogTitle) {
    metaTags.push({ property: 'og:title', content: contentMeta.ogTitle });
  }
  if (contentMeta?.ogDescription) {
    metaTags.push({ property: 'og:description', content: contentMeta.ogDescription });
  }
  if (contentMeta?.ogImage) {
    metaTags.push({ property: 'og:image', content: contentMeta.ogImage });
  }

  // Twitter Card tags
  if (contentMeta?.twitterCard) {
    metaTags.push({ name: 'twitter:card', content: contentMeta.twitterCard });
  }
  if (contentMeta?.twitterSite) {
    metaTags.push({ name: 'twitter:site', content: contentMeta.twitterSite });
  }

  return metaTags;
};

export default function CatchAll() {
  const data = useLoaderData<typeof loader>();
  const { contentData } = data;

  return (
    <main className="container mx-auto px-4 py-8 max-w-6xl min-h-screen">
      {/* Breadcrumb Navigation */}
      {contentData.navigation?.breadcrumbs && (
        <nav className="mb-6" aria-label="Breadcrumb">
          <ol className="flex items-center space-x-2 text-sm text-muted-foreground">
            {contentData.navigation.breadcrumbs.map((crumb, index) => (
              <li key={crumb.path} className="flex items-center">
                {index > 0 && <span className="mx-2">/</span>}
                {index === contentData.navigation.breadcrumbs!.length - 1 ? (
                  <span className="font-medium text-foreground">{crumb.label}</span>
                ) : (
                  <Link
                    to={crumb.path}
                    className="hover:text-foreground transition-colors"
                  >
                    {crumb.label}
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}

      {/* Main Content */}
      <div className="prose prose-lg max-w-none dark:prose-invert">
        <Markdown>{contentData.content}</Markdown>
      </div>

      {/* Related Pages */}
      {contentData.navigation?.relatedPages && contentData.navigation.relatedPages.length > 0 && (
        <div className="mt-12 border-t pt-8">
          <h2 className="text-lg font-semibold mb-4">Related Pages</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {contentData.navigation.relatedPages.map((page) => (
              <Link
                key={page.path}
                to={page.path}
                className="block p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <h3 className="font-medium">{page.title}</h3>
                {page.description && (
                  <p className="text-sm text-muted-foreground mt-1">{page.description}</p>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
