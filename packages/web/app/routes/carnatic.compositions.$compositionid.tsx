import { json, type MetaFunction } from '@remix-run/node';
import { useLoaderData, Link } from '@remix-run/react';
import { client } from '~/api.server';
import { EntityCompositions } from '~/components/shared/EntityCompositions';

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

    // Get 7 related compositions by composer (6 to show + 1 to check for more)
    const composerResult = await client.composition.byComposer.query({
      composerId: composition.composer.id,
      limit: 7,
    });

    const filteredCompositionsByComposer = composerResult.items.filter(
      (c: any) => c.id !== composition.id
    );
    const relatedCompositionsByComposer = filteredCompositionsByComposer.slice(0, 6);
    const hasMoreCompositionsByComposer =
      composerResult.hasMore || filteredCompositionsByComposer.length > 6;

    // Get compositions in the same raga(s) if the composition has ragas
    let relatedCompositionsByRaga: any[] = [];
    let hasMoreCompositionsByRaga = false;

    if (composition.ragas && composition.ragas.length > 0) {
      // Use the first raga for related compositions (most compositions have one primary raga)
      const primaryRaga = composition.ragas[0];
      const ragaResult = await client.composition.byRaga.query({
        ragaId: primaryRaga.id,
        limit: 7, // 6 to show + 1 to check for more
      });

      const filteredCompositionsByRaga = ragaResult.items.filter(
        (c: any) => c.id !== composition.id
      );
      relatedCompositionsByRaga = filteredCompositionsByRaga.slice(0, 6);
      hasMoreCompositionsByRaga = ragaResult.hasMore || filteredCompositionsByRaga.length > 6;
    }

    return json({
      composition,
      relatedCompositionsByComposer,
      hasMoreCompositionsByComposer,
      relatedCompositionsByRaga,
      hasMoreCompositionsByRaga,
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
  ragas: Array<{ id: string; name: string }>;
  talas: Array<{ id: string; name: string }>;
  createdAt: string;
  updatedAt: string;
};

export default function CompositionDetails() {
  const {
    composition,
    relatedCompositionsByComposer,
    hasMoreCompositionsByComposer,
    relatedCompositionsByRaga,
    hasMoreCompositionsByRaga,
  } = useLoaderData<{
    composition: Composition;
    relatedCompositionsByComposer: any[];
    hasMoreCompositionsByComposer: boolean;
    relatedCompositionsByRaga: any[];
    hasMoreCompositionsByRaga: boolean;
  }>();

  return (
    <div className="max-w-4xl m-auto">
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
            <strong>Composer:</strong>{' '}
            <Link
              to={`/carnatic/artists/${composition.composer.name.toLowerCase().replace(/\s+/g, '-')}-${composition.composer.id}`}
              className="text-primary hover:underline"
            >
              {composition.composer.name}
            </Link>
          </p>
          <p>
            <strong>Language:</strong>{' '}
            <Link
              to={`/carnatic/languages/${encodeURIComponent(composition.language)}`}
              className="text-primary hover:underline"
            >
              {composition.language}
            </Link>
          </p>
          {composition.ragas && composition.ragas.length > 0 && (
            <p>
              <strong>Raga{composition.ragas.length > 1 ? 's' : ''}:</strong>{' '}
              {composition.ragas.map((r, index) => (
                <span key={r.id}>
                  {index > 0 && ', '}
                  <Link
                    to={`/carnatic/ragas/${r.name.toLowerCase().replace(/\s+/g, '-')}-${r.id}`}
                    className="text-primary hover:underline"
                  >
                    {r.name}
                  </Link>
                </span>
              ))}
            </p>
          )}
          {composition.talas && composition.talas.length > 0 && (
            <p>
              <strong>Tala{composition.talas.length > 1 ? 's' : ''}:</strong>{' '}
              {composition.talas.map((t, index) => (
                <span key={t.id}>
                  {index > 0 && ', '}
                  <Link
                    to={`/carnatic/talas/${t.name.toLowerCase().replace(/\s+/g, '-')}-${t.id}`}
                    className="text-primary hover:underline"
                  >
                    {t.name}
                  </Link>
                </span>
              ))}
            </p>
          )}
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

      {relatedCompositionsByComposer.length > 0 && (
        <EntityCompositions
          compositions={relatedCompositionsByComposer}
          entityType="artist"
          entitySlug={`${composition.composer.name.toLowerCase().replace(/\s+/g, '-')}-${composition.composer.id}`}
          showViewMore={hasMoreCompositionsByComposer}
          customHeading={`More compositions by ${composition.composer.name}`}
        />
      )}

      {relatedCompositionsByRaga.length > 0 &&
        composition.ragas &&
        composition.ragas.length > 0 && (
          <EntityCompositions
            compositions={relatedCompositionsByRaga}
            entityType="raga"
            entitySlug={`${composition.ragas[0].name.toLowerCase().replace(/\s+/g, '-')}-${composition.ragas[0].id}`}
            showViewMore={hasMoreCompositionsByRaga}
            customHeading={`More compositions in ${composition.ragas[0].name} raga`}
          />
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
    </div>
  );
}
