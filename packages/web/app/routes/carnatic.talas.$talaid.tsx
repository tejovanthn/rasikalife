import { json, type MetaFunction } from '@remix-run/node';
import { useLoaderData, Link, Outlet, useLocation } from '@remix-run/react';
import { client } from '~/api.server';
import { EntityCompositions } from '~/components/shared/EntityCompositions';
import { Breadcrumb } from '~/components/Breadcrumb';

export async function loader({ params }: { params: { talaid?: string } }) {
  const { talaid } = params;

  if (!talaid) {
    throw new Response('Tala ID is required', { status: 400 });
  }

  const slugId = talaid.split('-').pop();

  if (!slugId) {
    throw new Response('Invalid URL format', { status: 400 });
  }

  try {
    const tala = await client.tala.get.query({ id: slugId });

    if (!tala) {
      throw new Response('Tala not found', { status: 404 });
    }

    // Fetch compositions in this tala (limit to 6 for preview)
    const compositions = await client.composition.byTala.query({
      talaId: tala.id,
      limit: 6,
    });

    return json({
      tala,
      compositions: compositions.items,
      hasMoreCompositions: compositions.hasMore,
    });
  } catch (error) {
    console.error('Failed to load tala:', error);
    throw new Response('Failed to load tala', { status: 500 });
  }
}

export const meta: MetaFunction = ({ data }) => {
  const tala = (data as any)?.tala;

  if (tala) {
    return [
      { title: `${tala.name} Tala - Indian Classical Music - Rasika.life` },
      {
        name: 'description',
        content: `Learn about the ${tala.name} tala in Indian classical music. Discover this traditional rhythmic cycle used in Carnatic music.`,
      },
      {
        name: 'keywords',
        content: `${tala.name} tala, Indian classical tala, Carnatic tala, rhythmic cycle, classical music rhythm`,
      },
      // Open Graph tags for social sharing
      { property: 'og:title', content: `${tala.name} Tala - Indian Classical Music` },
      {
        property: 'og:description',
        content: `Learn about the ${tala.name} tala, a fundamental rhythmic cycle in Indian classical music`,
      },
      { property: 'og:type', content: 'article' },
      {
        property: 'og:url',
        content: `https://rasika.life/carnatic/talas/${tala.name.toLowerCase().replace(/\s+/g, '-')}-${tala.id}`,
      },
      // Twitter Card tags
      { name: 'twitter:card', content: 'summary' },
      { name: 'twitter:title', content: `${tala.name} Tala` },
      { name: 'twitter:description', content: `Indian classical tala ${tala.name}` },
      // Canonical URL
      {
        tagName: 'link',
        rel: 'canonical',
        href: `https://rasika.life/carnatic/talas/${tala.name.toLowerCase().replace(/\s+/g, '-')}-${tala.id}`,
      },
      // Breadcrumb structured data
      {
        tagName: 'script',
        type: 'application/ld+json',
        innerHTML: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://rasika.life' },
            {
              '@type': 'ListItem',
              position: 2,
              name: 'Carnatic',
              item: 'https://rasika.life/carnatic',
            },
            {
              '@type': 'ListItem',
              position: 3,
              name: 'Talas',
              item: 'https://rasika.life/carnatic/talas',
            },
            {
              '@type': 'ListItem',
              position: 4,
              name: `${tala.name} Tala`,
              item: `https://rasika.life/carnatic/talas/${tala.name.toLowerCase().replace(/\s+/g, '-')}-${tala.id}`,
            },
          ],
        }),
      },
    ];
  }

  return [
    { title: 'Tala - Rasika.life' },
    {
      name: 'description',
      content: 'Explore detailed information about Indian classical talas.',
    },
  ];
};

// Tala type from @rasika/core domain/tala
type Tala = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export default function TalaDetails() {
  const location = useLocation();

  const { tala, compositions, hasMoreCompositions } = useLoaderData<{
    tala: Tala;
    compositions: any[];
    hasMoreCompositions: boolean;
  }>();

  // Check if we're on a nested route (like /compositions)
  const isNestedRoute = location.pathname.includes('/compositions');

  if (isNestedRoute) {
    return <Outlet />;
  }

  const breadcrumbItems = [
    { label: 'Home', path: '/' },
    { label: 'Carnatic', path: '/carnatic' },
    { label: 'Talas', path: '/carnatic/talas' },
    {
      label: tala.name,
      path: `/carnatic/talas/${tala.name.toLowerCase().replace(/\s+/g, '-')}-${tala.id}`,
    },
  ];

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <Breadcrumb items={breadcrumbItems} />
      <header className="mb-8">
        <h1 className="text-4xl font-bold mb-2">{tala.name}</h1>
        <p className="text-lg text-muted-foreground">Indian Classical Tala</p>
      </header>

      <section className="mb-8 p-6 bg-muted rounded-lg">
        <h2 className="text-xl font-semibold mb-4">About</h2>
        <div className="space-y-2 text-sm">
          <p>
            <strong>Name:</strong> {tala.name}
          </p>
          <p>
            <strong>Added:</strong> {new Date(tala.createdAt).toLocaleDateString()}
          </p>
        </div>
      </section>

      <EntityCompositions
        compositions={compositions}
        entityType="tala"
        entitySlug={`${tala.name.toLowerCase().replace(/\s+/g, '-')}-${tala.id}`}
        showViewMore={hasMoreCompositions}
      />

      {/* Cross-linking section */}
      <section className="mt-8 pt-8 border-t">
        <h2 className="text-xl font-semibold mb-4">Explore Related Content</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Link
            to="/carnatic/talas"
            className="p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors text-center"
          >
            <h3 className="font-medium">All Talas</h3>
            <p className="text-sm text-muted-foreground">Browse other talas</p>
          </Link>

          <Link
            to="/carnatic/compositions"
            className="p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors text-center"
          >
            <h3 className="font-medium">Compositions</h3>
            <p className="text-sm text-muted-foreground">Find compositions in this tala</p>
          </Link>

          <Link
            to="/carnatic"
            className="p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors text-center"
          >
            <h3 className="font-medium">Carnatic Music</h3>
            <p className="text-sm text-muted-foreground">Learn about the tradition</p>
          </Link>
        </div>
      </section>
    </main>
  );
}

export function ErrorBoundary() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-red-600">Something went wrong</h1>
      <p className="text-muted-foreground">
        We're having trouble loading this tala. Please try again later.
      </p>
      <Link to="/carnatic/talas" className="text-blue-600 hover:underline">
        Back to Talas
      </Link>
    </div>
  );
}
