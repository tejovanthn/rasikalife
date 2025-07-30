import type { LoaderFunction, MetaFunction, ErrorBoundaryComponent } from '@remix-run/node';
import { json } from '@remix-run/node';
import { Link, useLoaderData, isRouteErrorResponse, useRouteError } from '@remix-run/react';
import { client } from '~/api.server';
import { slugify } from '~/lib/carnaticUtils';
import { OptimisticViewCounter } from '~/components/OptimisticViewCounter';

type LoaderData = {
  tala: any;
  compositions: any[];
  breadcrumbs: Array<{ name: string; href: string }>;
};

export const loader: LoaderFunction = async ({ params, request }) => {
  if (!params.talaid) {
    throw new Response('Not Found', {
      status: 404,
      statusText: 'Tala ID is required',
    });
  }

  // Extract ID from slug (format: "tala-name-TALA_ID")
  const talaId = params.talaid.split('-').pop();
  if (!talaId) {
    throw new Response('Invalid tala ID format', {
      status: 400,
      statusText: 'Invalid URL format',
    });
  }

  try {
    // Get tala details
    const tala = await client.tala.getById({ id: talaId, trackView: true });

    if (!tala) {
      throw new Response('Tala not found', {
        status: 404,
        statusText: 'The requested tala could not be found',
      });
    }

    // Get compositions in this tala
    const compositions = await client.composition.search.query({
      talaId: tala.id,
      limit: 20,
    });

    // Build breadcrumbs for better navigation and SEO
    const breadcrumbs = [
      { name: 'Home', href: '/' },
      { name: 'Carnatic', href: '/carnatic' },
      { name: 'Talas', href: '/carnatic/talas' },
      { name: tala.name, href: `/carnatic/talas/${params.talaid}` },
    ];

    return json<LoaderData>({
      tala,
      compositions: compositions.items,
      breadcrumbs,
    });
  } catch (error) {
    console.error('Error loading tala:', error);
    if (error instanceof Response) {
      throw error;
    }
    throw new Response('Internal Server Error', {
      status: 500,
      statusText: 'Failed to load tala data',
    });
  }
};

export const meta: MetaFunction<typeof loader> = ({ data, params, location }) => {
  const canonicalUrl = `https://rasika.life${location.pathname}`;

  if (!data?.tala) {
    return [
      { title: 'Tala Not Found - Rasika.life' },
      { name: 'description', content: 'The requested tala could not be found.' },
      { name: 'robots', content: 'noindex' },
      { rel: 'canonical', href: canonicalUrl },
    ];
  }

  const { tala, compositions } = data;
  const title = `${tala.name} - ${tala.aksharas} Aksharas - Indian Classical Music`;
  const description = `Learn about ${tala.name}, a tala with ${tala.aksharas} aksharas in Carnatic music. ${tala.description || `Explore ${compositions.length} compositions in this tala.`}`;

  return [
    { title },
    { name: 'description', content: description },
    {
      name: 'keywords',
      content: `${tala.name}, tala, Carnatic music, Indian classical music, rhythm, ${tala.aksharas} aksharas`,
    },
    { rel: 'canonical', href: canonicalUrl },

    // OpenGraph
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:type', content: 'article' },
    { property: 'og:url', content: canonicalUrl },
    { property: 'og:site_name', content: 'Rasika.life' },

    // Twitter Card
    { name: 'twitter:card', content: 'summary' },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description },

    // Structured data for rich snippets
    {
      'script:ld+json': {
        '@context': 'https://schema.org',
        '@type': 'Article',
        name: tala.name,
        description: tala.description || `A tala with ${tala.aksharas} aksharas in Carnatic music`,
        identifier: `${tala.aksharas} aksharas`,
        dateCreated: tala.createdAt,
        dateModified: tala.updatedAt,
        url: canonicalUrl,
        breadcrumb: {
          '@type': 'BreadcrumbList',
          itemListElement: data.breadcrumbs.map((crumb, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: crumb.name,
            item: `https://rasika.life${crumb.href}`,
          })),
        },
      },
    },
  ];
};

// Enhanced Error Boundary
export const ErrorBoundary: ErrorBoundaryComponent = () => {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return (
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            {error.status} - {error.statusText}
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            {error.status === 404
              ? "The tala you're looking for doesn't exist or has been moved."
              : 'Something went wrong while loading this tala.'}
          </p>
          <div className="space-x-4">
            <Link
              to="/carnatic/talas"
              className="inline-block px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              Browse All Talas
            </Link>
            <Link
              to="/carnatic"
              className="inline-block px-6 py-3 border border-primary text-primary rounded-lg hover:bg-primary/10 transition-colors"
            >
              Back to Carnatic
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-destructive mb-4">Oops! Something went wrong</h1>
        <p className="text-xl text-muted-foreground mb-8">
          We encountered an unexpected error while loading this tala.
        </p>
        <Link
          to="/carnatic/talas"
          className="inline-block px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          Browse All Talas
        </Link>
      </div>
    </main>
  );
};

// Breadcrumb component for better navigation
const Breadcrumbs = ({ breadcrumbs }: { breadcrumbs: LoaderData['breadcrumbs'] }) => (
  <nav className="mb-6" aria-label="Breadcrumb">
    <ol className="flex space-x-2 text-sm text-muted-foreground">
      {breadcrumbs.map((crumb, index) => (
        <li key={crumb.href} className="flex items-center">
          {index > 0 && <span className="mx-2">/</span>}
          {index === breadcrumbs.length - 1 ? (
            <span className="text-foreground font-medium">{crumb.name}</span>
          ) : (
            <Link to={crumb.href} className="hover:text-primary transition-colors">
              {crumb.name}
            </Link>
          )}
        </li>
      ))}
    </ol>
  </nav>
);

export default function TalaDetails() {
  const { tala, compositions, breadcrumbs } = useLoaderData<LoaderData>();

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <Breadcrumbs breadcrumbs={breadcrumbs} />

      {/* Header */}
      <header className="mb-8">
        <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl mb-4">
          {tala.name}
        </h1>

        {/* Alternative Names */}
        {tala.alternativeNames && tala.alternativeNames.length > 0 && (
          <p className="text-lg text-muted-foreground mb-4">
            Also known as: {tala.alternativeNames.join(', ')}
          </p>
        )}

        {/* Metadata */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
          <div>
            <span className="font-semibold">Aksharas:</span>{' '}
            <span className="text-primary font-medium">{tala.aksharas}</span>
          </div>
          {tala.type && (
            <div>
              <span className="font-semibold">Type:</span> {tala.type}
            </div>
          )}
          {tala.tradition && (
            <div>
              <span className="font-semibold">Tradition:</span> {tala.tradition}
            </div>
          )}
          {tala.structure && (
            <div className="md:col-span-2 lg:col-span-3">
              <span className="font-semibold">Structure:</span> {tala.structure}
            </div>
          )}
        </div>
      </header>

      {/* Rhythm Pattern Visualization */}
      <section className="mb-8">
        <h2 className="text-2xl font-bold tracking-tight mb-4">Rhythm Pattern</h2>
        <div className="p-6 bg-primary/5 rounded-lg">
          <div className="grid gap-4">
            {tala.structure && (
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Structure</h3>
                <div className="font-mono text-lg text-center p-3 bg-background rounded border tracking-wider">
                  {tala.structure}
                </div>
              </div>
            )}
            <div className="text-center">
              <div className="inline-flex items-center gap-4 text-sm text-muted-foreground">
                <span>
                  Total: <strong>{tala.aksharas} aksharas</strong>
                </span>
                {tala.type && <span>•</span>}
                {tala.type && (
                  <span>
                    Type: <strong>{tala.type}</strong>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Notation */}
      {tala.notation && (
        <section className="mb-8">
          <h2 className="text-2xl font-bold tracking-tight mb-4">Notation & Beats</h2>
          <div className="p-6 bg-muted rounded-lg">
            <div className="font-mono text-lg whitespace-pre-line">{tala.notation}</div>
          </div>
        </section>
      )}

      {/* Examples */}
      {tala.examples && tala.examples.length > 0 && (
        <section className="mb-8">
          <h2 className="text-2xl font-bold tracking-tight mb-4">Examples & Practice</h2>
          <div className="grid gap-3">
            {tala.examples.map((example, index) => (
              <div key={index} className="p-4 border border-border rounded-lg bg-card">
                <div className="text-foreground">{example}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Compositions */}
      {compositions.length > 0 && (
        <section className="mb-8">
          <h2 className="text-2xl font-bold tracking-tight mb-4">
            Compositions ({compositions.length})
          </h2>
          <div className="grid gap-4">
            {compositions.map((composition: any) => (
              <div
                key={composition.id}
                className="p-4 border border-border rounded-lg hover:shadow-md transition-shadow bg-card"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <Link
                      to={slugify({
                        name: composition.title,
                        id: composition.id,
                        type: 'compositions',
                      })}
                      className="text-lg font-semibold text-primary hover:text-primary/80"
                    >
                      {composition.title}
                    </Link>
                    <div className="text-sm text-muted-foreground mt-1">
                      {composition.ragaName && `Raga: ${composition.ragaName}`}
                      {composition.language && ` • Language: ${composition.language}`}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Footer metadata */}
      <footer className="mt-12 pt-8 border-t text-sm text-muted-foreground">
        <div className="flex flex-col sm:flex-row sm:justify-between gap-2">
          <div>Created: {new Date(tala.createdAt).toLocaleDateString()}</div>
          <div>Last updated: {new Date(tala.updatedAt).toLocaleDateString()}</div>
          <div>
            <OptimisticViewCounter
              entityId={tala.id}
              initialViewCount={tala.viewCount || 0}
              entityType="tala"
            />
          </div>
        </div>
      </footer>
    </main>
  );
}
