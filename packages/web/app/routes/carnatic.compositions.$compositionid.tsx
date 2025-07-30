import type { LoaderFunction, MetaFunction, ErrorBoundaryComponent } from '@remix-run/node';
import { json, defer } from '@remix-run/node';
import { Link, useLoaderData, isRouteErrorResponse, useRouteError, Await } from '@remix-run/react';
import { Suspense } from 'react';
import { type RouterOutput, client } from '~/api.server';
import { slugify } from '~/lib/carnaticUtils';
import { OptimisticViewCounter } from '~/components/OptimisticViewCounter';
import { RelatedCompositions, RelatedCompositionsSkeleton } from '~/components/RelatedCompositions';

// ... existing types and loader code ...

type LoaderData = {
  composition: NonNullable<RouterOutput['composition']['getWithAttributions']>;
  relatedCompositions: Promise<RouterOutput['composition']['search']['items']>;
  breadcrumbs: Array<{ name: string; href: string }>;
};

export const loader: LoaderFunction = async ({ params, request }) => {
  if (!params.compositionid) {
    throw new Response('Not Found', {
      status: 404,
      statusText: 'Composition ID is required',
    });
  }

  // Extract ID from slug (format: "composition-name-COMPOSITION_ID")
  const compositionId = params.compositionid.split('-').pop();
  if (!compositionId) {
    throw new Response('Invalid composition ID format', {
      status: 400,
      statusText: 'Invalid URL format',
    });
  }

  try {
    // Get composition with attributions
    const composition = await client.composition.getWithAttributions({
      id: compositionId,
      trackView: true,
    });

    if (!composition) {
      throw new Response('Composition not found', {
        status: 404,
        statusText: 'The requested composition could not be found',
      });
    }

    // Defer related compositions for better performance
    const relatedCompositionsPromise = client.composition.search
      .query({
        ragaId: composition.ragaId,
        limit: 5,
      })
      .then((result: any) => result.items.filter((c: any) => c.id !== composition.id));

    // Build breadcrumbs for better navigation and SEO
    const breadcrumbs = [
      { name: 'Home', href: '/' },
      { name: 'Carnatic', href: '/carnatic' },
      { name: 'Compositions', href: '/carnatic/compositions' },
      { name: composition.title, href: `/carnatic/compositions/${params.compositionid}` },
    ];

    return defer<LoaderData>({
      composition,
      relatedCompositions: relatedCompositionsPromise,
      breadcrumbs,
    });
  } catch (error) {
    console.error('Error loading composition:', error);
    if (error instanceof Response) {
      throw error;
    }
    throw new Response('Internal Server Error', {
      status: 500,
      statusText: 'Failed to load composition data',
    });
  }
};

export const meta: MetaFunction<typeof loader> = ({ data, params, location }) => {
  const canonicalUrl = `https://rasika.life${location.pathname}`;

  if (!data?.composition) {
    return [
      { title: 'Composition Not Found - Rasika.life' },
      { name: 'description', content: 'The requested composition could not be found.' },
      { name: 'robots', content: 'noindex' },
      { rel: 'canonical', href: canonicalUrl },
    ];
  }

  const { composition } = data;
  const title = `${composition.title} - ${composition.ragaName || 'Unknown Raga'} - Indian Classical Music`;
  const description = `Learn about ${composition.title}, a beautiful composition in Raga ${composition.ragaName || 'Unknown'} and Tala ${composition.talaName || 'Unknown'}. ${composition.meaning ? composition.meaning.substring(0, 150) + '...' : 'Explore lyrics, meaning, and musical details.'}`;

  return [
    { title },
    { name: 'description', content: description },
    {
      name: 'keywords',
      content: `${composition.title}, ${composition.ragaName}, ${composition.talaName}, Indian classical music, Carnatic music, composition, lyrics`,
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
        '@type': 'MusicComposition',
        name: composition.title,
        alternateName: composition.alternativeTitles,
        description: composition.meaning || `A composition in ${composition.ragaName} raga`,
        inLanguage: composition.language,
        text: composition.lyrics,
        ...(composition.attributions.length > 0 && {
          composer: {
            '@type': 'Person',
            name: composition.attributions[0].artistName,
          },
        }),
        musicalKey: composition.ragaName,
        dateCreated: composition.createdAt,
        dateModified: composition.updatedAt,
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
              ? "The composition you're looking for doesn't exist or has been moved."
              : 'Something went wrong while loading this composition.'}
          </p>
          <div className="space-x-4">
            <Link
              to="/carnatic/compositions"
              className="inline-block px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              Browse All Compositions
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
          We encountered an unexpected error while loading this composition.
        </p>
        <Link
          to="/carnatic/compositions"
          className="inline-block px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          Browse All Compositions
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

// ... rest of existing component code, but add breadcrumbs ...

export default function CompositionDetails() {
  const { composition, relatedCompositions, breadcrumbs } = useLoaderData<LoaderData>();

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <Breadcrumbs breadcrumbs={breadcrumbs} />

      {/* Rest of existing component... */}
      {/* Header */}
      <header className="mb-8">
        <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl mb-4">
          {composition.title}
        </h1>

        {composition.alternativeTitles && composition.alternativeTitles.length > 0 && (
          <p className="text-lg text-muted-foreground mb-4">
            Also known as: {composition.alternativeTitles.join(', ')}
          </p>
        )}

        {/* Metadata */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
          <div>
            <span className="font-semibold">Raga:</span>{' '}
            {composition.ragaName ? (
              <Link
                to={slugify({ name: composition.ragaName, id: composition.ragaId, type: 'ragas' })}
                className="text-primary hover:text-primary/80 underline"
              >
                {composition.ragaName}
              </Link>
            ) : (
              <span className="text-muted-foreground">Unknown</span>
            )}
          </div>
          <div>
            <span className="font-semibold">Tala:</span>{' '}
            {composition.talaName ? (
              <Link
                to={slugify({ name: composition.talaName, id: composition.talaId, type: 'talas' })}
                className="text-primary hover:text-primary/80 underline"
              >
                {composition.talaName}
              </Link>
            ) : (
              <span className="text-muted-foreground">Unknown</span>
            )}
          </div>
          {composition.language && (
            <div>
              <span className="font-semibold">Language:</span> {composition.language}
            </div>
          )}
          {composition.tradition && (
            <div>
              <span className="font-semibold">Tradition:</span> {composition.tradition}
            </div>
          )}
        </div>
      </header>

      {/* Deferred Related Compositions */}
      <Suspense fallback={<RelatedCompositionsSkeleton />}>
        <Await resolve={relatedCompositions}>
          {compositions => (
            <RelatedCompositions compositions={compositions} ragaName={composition.ragaName} />
          )}
        </Await>
      </Suspense>

      {/* Footer metadata */}
      <footer className="mt-12 pt-8 border-t text-sm text-muted-foreground">
        <div className="flex flex-col sm:flex-row sm:justify-between gap-2">
          <div>Created: {new Date(composition.createdAt).toLocaleDateString()}</div>
          <div>Last updated: {new Date(composition.updatedAt).toLocaleDateString()}</div>
          <div>
            <OptimisticViewCounter
              entityId={composition.id}
              initialViewCount={composition.viewCount || 0}
              entityType="composition"
            />
          </div>
        </div>
      </footer>
    </main>
  );
}
