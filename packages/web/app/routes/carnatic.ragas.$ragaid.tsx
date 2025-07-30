import type { LoaderFunction, MetaFunction, ErrorBoundaryComponent } from '@remix-run/node';
import { json } from '@remix-run/node';
import { Link, useLoaderData, isRouteErrorResponse, useRouteError } from '@remix-run/react';
import { client } from '~/api.server';
import { slugify } from '~/lib/carnaticUtils';
import { OptimisticViewCounter } from '~/components/OptimisticViewCounter';

type LoaderData = {
  raga: any;
  compositions: any[];
  breadcrumbs: Array<{ name: string; href: string }>;
};

export const loader: LoaderFunction = async ({ params, request }) => {
  if (!params.ragaid) {
    throw new Response('Not Found', {
      status: 404,
      statusText: 'Raga ID is required',
    });
  }

  // Extract ID from slug (format: "raga-name-RAGA_ID")
  const ragaId = params.ragaid.split('-').pop();
  if (!ragaId) {
    throw new Response('Invalid raga ID format', {
      status: 400,
      statusText: 'Invalid URL format',
    });
  }

  try {
    // Get raga details
    const raga = await client.raga.getById({ id: ragaId, trackView: true });

    if (!raga) {
      throw new Response('Raga not found', {
        status: 404,
        statusText: 'The requested raga could not be found',
      });
    }

    // Get compositions in this raga
    const compositions = await client.composition.search.query({
      ragaId: raga.id,
      limit: 20,
    });

    // Build breadcrumbs for better navigation and SEO
    const breadcrumbs = [
      { name: 'Home', href: '/' },
      { name: 'Carnatic', href: '/carnatic' },
      { name: 'Ragas', href: '/carnatic/ragas' },
      { name: raga.name, href: `/carnatic/ragas/${params.ragaid}` },
    ];

    return json<LoaderData>({
      raga,
      compositions: compositions.items,
      breadcrumbs,
    });
  } catch (error) {
    console.error('Error loading raga:', error);
    if (error instanceof Response) {
      throw error;
    }
    throw new Response('Internal Server Error', {
      status: 500,
      statusText: 'Failed to load raga data',
    });
  }
};

export const meta: MetaFunction<typeof loader> = ({ data, params, location }) => {
  const canonicalUrl = `https://rasika.life${location.pathname}`;

  if (!data?.raga) {
    return [
      { title: 'Raga Not Found - Rasika.life' },
      { name: 'description', content: 'The requested raga could not be found.' },
      { name: 'robots', content: 'noindex' },
      { rel: 'canonical', href: canonicalUrl },
    ];
  }

  const { raga, compositions } = data;
  const title = `${raga.name} - ${raga.melakarta ? `Melakarta ${raga.melakarta}` : 'Janya Raga'} - Indian Classical Music`;
  const description = `Learn about ${raga.name}, a ${raga.melakarta ? `melakarta raga (${raga.melakarta})` : 'janya raga'} in Carnatic music. ${raga.description || `Explore ${compositions.length} compositions in this raga.`}`;

  return [
    { title },
    { name: 'description', content: description },
    {
      name: 'keywords',
      content: `${raga.name}, raga, Carnatic music, Indian classical music, melakarta, janya, ${raga.melakarta || ''}`,
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
        name: raga.name,
        description:
          raga.description || `A ${raga.melakarta ? 'melakarta' : 'janya'} raga in Carnatic music`,
        ...(raga.melakarta && { identifier: `Melakarta ${raga.melakarta}` }),
        dateCreated: raga.createdAt,
        dateModified: raga.updatedAt,
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
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            {error.status} - {error.statusText}
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            {error.status === 404
              ? "The raga you're looking for doesn't exist or has been moved."
              : 'Something went wrong while loading this raga.'}
          </p>
          <div className="space-x-4">
            <Link
              to="/carnatic/ragas"
              className="inline-block px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              Browse All Ragas
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
          We encountered an unexpected error while loading this raga.
        </p>
        <Link
          to="/carnatic/ragas"
          className="inline-block px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          Browse All Ragas
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

export default function RagaDetails() {
  const { raga, compositions, breadcrumbs } = useLoaderData<LoaderData>();

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <Breadcrumbs breadcrumbs={breadcrumbs} />

      {/* Header */}
      <header className="mb-8">
        <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl mb-4">
          {raga.name}
        </h1>

        {/* Alternative Names */}
        {raga.alternativeNames && raga.alternativeNames.length > 0 && (
          <p className="text-lg text-muted-foreground mb-4">
            Also known as: {raga.alternativeNames.join(', ')}
          </p>
        )}

        {/* Metadata */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
          <div>
            <span className="font-semibold">Type:</span>{' '}
            <span
              className={raga.melakarta ? 'text-primary' : 'text-green-600 dark:text-green-400'}
            >
              {raga.melakarta ? `Melakarta (${raga.melakarta})` : 'Janya Raga'}
            </span>
          </div>
          {raga.janaka && (
            <div>
              <span className="font-semibold">Janaka (Parent):</span> {raga.janaka}
            </div>
          )}
          {raga.tradition && (
            <div>
              <span className="font-semibold">Tradition:</span> {raga.tradition}
            </div>
          )}
          {raga.timeOfDay && (
            <div>
              <span className="font-semibold">Time of Day:</span> {raga.timeOfDay}
            </div>
          )}
          {raga.mood && raga.mood.length > 0 && (
            <div className="md:col-span-2 lg:col-span-3">
              <span className="font-semibold">Mood:</span> {raga.mood.join(', ')}
            </div>
          )}
        </div>
      </header>

      {/* Musical Structure */}
      {(raga.arohanam || raga.avarohanam) && (
        <section className="mb-8">
          <h2 className="text-2xl font-bold tracking-tight mb-4">Musical Structure</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-primary/5 rounded-lg">
            {raga.arohanam && (
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Arohanam (Ascending)</h3>
                <div className="font-mono text-lg text-center p-3 bg-background rounded border">
                  {raga.arohanam}
                </div>
              </div>
            )}
            {raga.avarohanam && (
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Avarohanam (Descending)
                </h3>
                <div className="font-mono text-lg text-center p-3 bg-background rounded border">
                  {raga.avarohanam}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Characteristic Phrases */}
      {raga.characteristicPhrases && raga.characteristicPhrases.length > 0 && (
        <section className="mb-8">
          <h2 className="text-2xl font-bold tracking-tight mb-4">
            Characteristic Phrases (Sancharas)
          </h2>
          <div className="grid gap-3">
            {raga.characteristicPhrases.map((phrase, index) => (
              <div key={index} className="p-3 bg-muted rounded-lg font-mono text-center">
                {phrase}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Notes & Theory */}
      {raga.notes && (
        <section className="mb-8">
          <h2 className="text-2xl font-bold tracking-tight mb-4">Musical Notes & Theory</h2>
          <div className="prose max-w-none">
            <div className="text-muted-foreground leading-relaxed whitespace-pre-line">
              {raga.notes}
            </div>
          </div>
        </section>
      )}

      {/* History */}
      {raga.history && (
        <section className="mb-8">
          <h2 className="text-2xl font-bold tracking-tight mb-4">History & Background</h2>
          <div className="prose max-w-none">
            <div className="text-muted-foreground leading-relaxed whitespace-pre-line">
              {raga.history}
            </div>
          </div>
        </section>
      )}

      {/* Famous Compositions */}
      {raga.famousCompositions && raga.famousCompositions.length > 0 && (
        <section className="mb-8">
          <h2 className="text-2xl font-bold tracking-tight mb-4">Famous Compositions</h2>
          <div className="grid gap-2">
            {raga.famousCompositions.map((composition, index) => (
              <div key={index} className="p-3 border border-border rounded-lg bg-card">
                <span className="text-foreground">{composition}</span>
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
                      {composition.talaName && `Tala: ${composition.talaName}`}
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
          <div>Created: {new Date(raga.createdAt).toLocaleDateString()}</div>
          <div>Last updated: {new Date(raga.updatedAt).toLocaleDateString()}</div>
          <div>
            <OptimisticViewCounter
              entityId={raga.id}
              initialViewCount={raga.viewCount || 0}
              entityType="raga"
            />
          </div>
        </div>
      </footer>
    </main>
  );
}
