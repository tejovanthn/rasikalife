import { json, type MetaFunction } from '@remix-run/node';
import { useLoaderData, Link } from '@remix-run/react';
import { client } from '~/api.server';

export async function loader({ params }: { params: { compositionid?: string } }) {
  const { compositionid } = params;

  if (!compositionid) {
    throw new Response('Composition ID is required', { status: 400 });
  }

  const slugId = compositionid.split('-').pop();

  if (!slugId) {
    throw new Response('Invalid URL format', { status: 400 });
  }

  try {
    const composition = await client.composition.get.query({ id: slugId });

    if (!composition) {
      throw new Response('Composition not found', { status: 404 });
    }

    // Get related compositions by the same composer
    const relatedCompositions = await client.composition.byArtist.query({
      artistId: composition.composer.id,
    });

    return json({
      composition,
      relatedCompositions: relatedCompositions
        .filter((c: any) => c.id !== composition.id)
        .slice(0, 6),
      breadcrumbs: [
        { name: 'Home', href: '/' },
        { name: 'Carnatic', href: '/carnatic' },
        { name: 'Compositions', href: '/carnatic/compositions' },
        { name: composition.title, href: `/carnatic/compositions/${compositionid}` },
      ],
    });
  } catch (error) {
    console.error('Failed to load composition:', error);
    throw new Response('Failed to load composition', { status: 500 });
  }
}

export const meta: MetaFunction = ({ data }) => {
  const composition = (data as any)?.composition;

  if (composition) {
    return [
      { title: `${composition.title} - Composition by ${composition.composer.name} - Rasika.life` },
      {
        name: 'description',
        content: `Learn about "${composition.title}", a ${composition.language} composition by ${composition.composer.name}. Explore the lyrics and musical structure of this Indian classical work.`,
      },
      {
        name: 'keywords',
        content: `${composition.title}, ${composition.composer.name}, Indian classical composition, ${composition.language} music, Carnatic composition`,
      },
      // Open Graph tags for social sharing
      { property: 'og:title', content: `${composition.title} - ${composition.composer.name}` },
      {
        property: 'og:description',
        content: `Indian classical ${composition.language} composition by ${composition.composer.name}`,
      },
      { property: 'og:type', content: 'music.song' },
      {
        property: 'og:url',
        content: `https://rasika.life/carnatic/compositions/${composition.title.toLowerCase().replace(/\s+/g, '-')}-${composition.id}`,
      },
      // Twitter Card tags
      { name: 'twitter:card', content: 'summary' },
      { name: 'twitter:title', content: `${composition.title} - ${composition.composer.name}` },
      {
        name: 'twitter:description',
        content: `Indian classical ${composition.language} composition`,
      },
      // Canonical URL
      {
        tagName: 'link',
        rel: 'canonical',
        href: `https://rasika.life/carnatic/compositions/${composition.title.toLowerCase().replace(/\s+/g, '-')}-${composition.id}`,
      },
      // Breadcrumb structured data for SEO
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
              name: 'Compositions',
              item: 'https://rasika.life/carnatic/compositions',
            },
            {
              '@type': 'ListItem',
              position: 4,
              name: composition.title,
              item: `https://rasika.life/carnatic/compositions/${composition.title.toLowerCase().replace(/\s+/g, '-')}-${composition.id}`,
            },
          ],
        }),
      },
      // MusicComposition structured data
      {
        tagName: 'script',
        type: 'application/ld+json',
        innerHTML: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'MusicComposition',
          name: composition.title,
          composer: {
            '@type': 'Person',
            name: composition.composer.name,
          },
          inLanguage: composition.language,
          datePublished: composition.createdAt,
          dateModified: composition.updatedAt,
          text: composition.lyricsV1?.map((lyric: any) => lyric.text).join('\n') || '',
          url: `https://rasika.life/carnatic/compositions/${composition.title.toLowerCase().replace(/\s+/g, '-')}-${composition.id}`,
        }),
      },
    ];
  }

  return [
    { title: 'Composition - Rasika.life' },
    {
      name: 'description',
      content: 'Explore detailed information about Indian classical music compositions.',
    },
  ];
};

// Composition type from @rasika/core domain/composition
type Composition = {
  id: string;
  title: string;
  composer: {
    id: string;
    name: string;
  };
  language: string;
  lyricsV1?: Array<{
    type: string;
    order: number;
    text: string;
    number?: number;
    ragaName?: string;
  }>;
  createdAt: string;
  updatedAt: string;
};

export default function CompositionDetails() {
  const { composition, relatedCompositions } = useLoaderData<{
    composition: Composition;
    relatedCompositions: Composition[];
  }>();

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <header className="mb-8">
        <h1 className="text-4xl font-bold mb-2">{composition.title}</h1>
        <p className="text-xl text-muted-foreground">by {composition.composer.name}</p>
        <p className="text-lg text-muted-foreground">Language: {composition.language}</p>
      </header>

      <section className="mb-8 p-6 bg-muted rounded-lg">
        <h2 className="text-xl font-semibold mb-4">About</h2>
        <div className="space-y-2 text-sm">
          <p>
            <strong>Title:</strong> {composition.title}
          </p>
          <p>
            <strong>Composer:</strong> {composition.composer.name}
          </p>
          <p>
            <strong>Language:</strong> {composition.language}
          </p>
          <p>
            <strong>Added:</strong> {new Date(composition.createdAt).toLocaleDateString()}
          </p>
        </div>
      </section>

      {composition.lyricsV1 && composition.lyricsV1.length > 0 && (
        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Lyrics</h2>
          <div className="space-y-4">
            {composition.lyricsV1.map((lyric: any, index: number) => (
              <div key={index} className="p-4 bg-muted rounded-lg">
                <p className="whitespace-pre-line">{lyric.text}</p>
                {lyric.ragaName && (
                  <p className="text-sm text-muted-foreground mt-2">Raga: {lyric.ragaName}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {relatedCompositions.length > 0 && (
        <section>
          <h2 className="text-2xl font-semibold mb-4">
            More compositions by{' '}
            <Link
              to={`/carnatic/artists/${composition.composer.name.toLowerCase().replace(/\s+/g, '-')}-${composition.composer.id}`}
              className="text-primary hover:underline"
            >
              {composition.composer.name}
            </Link>
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {relatedCompositions.map((comp: any) => (
              <Link
                key={comp.id}
                to={`/carnatic/compositions/${comp.title.toLowerCase().replace(/\s+/g, '-')}-${comp.id}`}
                className="block p-4 border rounded-lg hover:shadow-md transition-shadow hover:border-primary/50"
              >
                <h3 className="font-medium">{comp.title}</h3>
                <p className="text-sm text-muted-foreground">{comp.language}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Cross-linking to related musical elements */}
      <section className="mt-8 pt-8 border-t">
        <h2 className="text-xl font-semibold mb-4">Explore Related Content</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Link
            to={`/carnatic/artists/${composition.composer.name.toLowerCase().replace(/\s+/g, '-')}-${composition.composer.id}`}
            className="p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors text-center"
          >
            <h3 className="font-medium">Artist Profile</h3>
            <p className="text-sm text-muted-foreground">Learn about {composition.composer.name}</p>
          </Link>

          <Link
            to="/carnatic/compositions"
            className="p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors text-center"
          >
            <h3 className="font-medium">All Compositions</h3>
            <p className="text-sm text-muted-foreground">Browse more compositions</p>
          </Link>

          <Link
            to="/carnatic"
            className="p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors text-center"
          >
            <h3 className="font-medium">Carnatic Music</h3>
            <p className="text-sm text-muted-foreground">Explore the tradition</p>
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
        We're having trouble loading this composition. Please try again later.
      </p>
      <Link to="/carnatic/compositions" className="text-blue-600 hover:underline">
        Back to Compositions
      </Link>
    </div>
  );
}
