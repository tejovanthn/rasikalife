import { json, type MetaFunction } from '@remix-run/node';
import { useLoaderData, Link } from '@remix-run/react';
import { client } from '~/api.server';

export async function loader({ params }: { params: { ragaid?: string } }) {
  const { ragaid } = params;

  if (!ragaid) {
    throw new Response('Raga ID is required', { status: 400 });
  }

  const slugId = ragaid.split('-').pop();

  if (!slugId) {
    throw new Response('Invalid URL format', { status: 400 });
  }

  try {
    const raga = await client.raga.get.query({ id: slugId });

    if (!raga) {
      throw new Response('Raga not found', { status: 404 });
    }

    return json({
      raga,
      breadcrumbs: [
        { name: 'Home', href: '/' },
        { name: 'Carnatic', href: '/carnatic' },
        { name: 'Ragas', href: '/carnatic/ragas' },
        { name: raga.name, href: `/carnatic/ragas/${ragaid}` },
      ],
    });
  } catch (error) {
    console.error('Failed to load raga:', error);
    throw new Response('Failed to load raga', { status: 500 });
  }
}

export const meta: MetaFunction = ({ data }) => {
  const raga = (data as any)?.raga;

  if (raga) {
    return [
      { title: `${raga.name} Raga - Indian Classical Music - Rasika.life` },
      {
        name: 'description',
        content: `Learn about the ${raga.name} raga in Indian classical music. Discover this traditional melodic mode used in Carnatic and Hindustani traditions.`,
      },
      {
        name: 'keywords',
        content: `${raga.name} raga, Indian classical raga, Carnatic raga, Hindustani raga, melodic mode, classical music scale`,
      },
      // Open Graph tags for social sharing
      { property: 'og:title', content: `${raga.name} Raga - Indian Classical Music` },
      {
        property: 'og:description',
        content: `Learn about the ${raga.name} raga, a fundamental melodic mode in Indian classical music`,
      },
      { property: 'og:type', content: 'article' },
      {
        property: 'og:url',
        content: `https://rasika.life/carnatic/ragas/${raga.name.toLowerCase().replace(/\s+/g, '-')}-${raga.id}`,
      },
      // Twitter Card tags
      { name: 'twitter:card', content: 'summary' },
      { name: 'twitter:title', content: `${raga.name} Raga` },
      { name: 'twitter:description', content: `Indian classical raga ${raga.name}` },
      // Canonical URL
      {
        tagName: 'link',
        rel: 'canonical',
        href: `https://rasika.life/carnatic/ragas/${raga.name.toLowerCase().replace(/\s+/g, '-')}-${raga.id}`,
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
              name: 'Ragas',
              item: 'https://rasika.life/carnatic/ragas',
            },
            {
              '@type': 'ListItem',
              position: 4,
              name: `${raga.name} Raga`,
              item: `https://rasika.life/carnatic/ragas/${raga.name.toLowerCase().replace(/\s+/g, '-')}-${raga.id}`,
            },
          ],
        }),
      },
    ];
  }

  return [
    { title: 'Raga - Rasika.life' },
    {
      name: 'description',
      content: 'Explore detailed information about Indian classical ragas.',
    },
  ];
};

// Raga type from @rasika/core domain/raga
type Raga = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export default function RagaDetails() {
  const { raga } = useLoaderData<{
    raga: Raga;
  }>();

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <header className="mb-8">
        <h1 className="text-4xl font-bold mb-2">{raga.name}</h1>
        <p className="text-lg text-muted-foreground">Indian Classical Raga</p>
      </header>

      <section className="mb-8 p-6 bg-muted rounded-lg">
        <h2 className="text-xl font-semibold mb-4">About</h2>
        <div className="space-y-2 text-sm">
          <p>
            <strong>Name:</strong> {raga.name}
          </p>
          <p>
            <strong>Added:</strong> {new Date(raga.createdAt).toLocaleDateString()}
          </p>
        </div>
      </section>

      {/* Cross-linking section */}
      <section className="mt-8 pt-8 border-t">
        <h2 className="text-xl font-semibold mb-4">Explore Related Content</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Link
            to="/carnatic/ragas"
            className="p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors text-center"
          >
            <h3 className="font-medium">All Ragas</h3>
            <p className="text-sm text-muted-foreground">Browse other ragas</p>
          </Link>

          <Link
            to="/carnatic/compositions"
            className="p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors text-center"
          >
            <h3 className="font-medium">Compositions</h3>
            <p className="text-sm text-muted-foreground">Find compositions in this raga</p>
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
        We're having trouble loading this raga. Please try again later.
      </p>
      <Link to="/carnatic/ragas" className="text-blue-600 hover:underline">
        Back to Ragas
      </Link>
    </div>
  );
}
