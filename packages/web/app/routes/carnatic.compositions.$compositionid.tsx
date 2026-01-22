import type { CompositionWithRelations } from '@rasika/core/types/entities';
import { type LinksFunction, type MetaFunction, data } from 'react-router';
import { Link, useLoaderData } from 'react-router';
import { client } from '~/api.server';
import { Breadcrumb } from '~/components/Breadcrumb';
import { EntityCompositions } from '~/components/shared/EntityCompositions';
import {
  BreadcrumbStructuredData,
  MusicCompositionStructuredData,
} from '~/components/structured-data';
import { ShareButtons } from '~/components/ui/share-buttons';
import { generateCompositionOGImage } from '~/lib/og';
import { generateCompositionUrl, parseSlug } from '~/lib/url-slug';

export async function loader({ params }: { params: { compositionid?: string } }) {
  const { compositionid } = params;

  if (!compositionid) {
    throw new Response('Composition ID is required', { status: 400 });
  }

  const parsed = parseSlug(compositionid);
  if (!parsed) {
    throw new Response('Invalid URL format', { status: 400 });
  }

  const { id: slugId } = parsed;

  if (!slugId) {
    throw new Response('Invalid URL format', { status: 400 });
  }

  try {
    const composition = await client.composition.get.query({ id: slugId });

    if (!composition) {
      throw new Response('Composition not found', { status: 404 });
    }

    // Get related compositions with error handling for network issues
    let relatedCompositionsByComposer: any[] = [];
    let hasMoreCompositionsByComposer = false;

    try {
      const composerResult = await client.composition.byComposer.query({
        composerId: composition.composer.id,
        limit: 7,
      });

      const filteredCompositions = composerResult.items.filter((c: any) => c.id !== composition.id);
      relatedCompositionsByComposer = filteredCompositions.slice(0, 6);
      hasMoreCompositionsByComposer = composerResult.hasMore || filteredCompositions.length > 6;
    } catch (error) {
      console.warn(
        'Failed to load related compositions by composer (tRPC server may be down):',
        error
      );
    }

    // Get compositions in the same raga(s) if the composition has ragas
    let relatedCompositionsByRaga: any[] = [];
    let hasMoreCompositionsByRaga = false;

    if (composition.ragas && composition.ragas.length > 0) {
      try {
        const primaryRaga = composition.ragas[0];
        const ragaResult = await client.composition.byRaga.query({
          ragaId: primaryRaga.id,
          limit: 7,
        });

        const filteredCompositions = ragaResult.items.filter((c: any) => c.id !== composition.id);
        relatedCompositionsByRaga = filteredCompositions.slice(0, 6);
        hasMoreCompositionsByRaga = ragaResult.hasMore || filteredCompositions.length > 6;
      } catch (error) {
        console.warn(
          'Failed to load related compositions by raga (tRPC server may be down):',
          error
        );
      }
    }

    return data({
      composition,
      relatedCompositionsByComposer,
      hasMoreCompositionsByComposer,
      relatedCompositionsByRaga,
      hasMoreCompositionsByRaga,
    });
  } catch (error) {
    console.error('Failed to load composition:', error);
    // Check if this is a tRPC error due to server being down
    if (error instanceof Error && error.message.includes('fetch')) {
      console.error('tRPC server appears to be down. Please ensure SST dev is running.');
    }
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
        content: `https://rasika.life${generateCompositionUrl(composition.title, composition.id)}`,
      },
      {
        property: 'og:image',
        content: generateCompositionOGImage(composition),
      },
      { property: 'music:musician', content: composition.composer.name },
      // Twitter Card tags
      { name: 'twitter:card', content: 'summary' },
      { name: 'twitter:title', content: `${composition.title} - ${composition.composer.name}` },
      {
        name: 'twitter:description',
        content: `Indian classical ${composition.language} composition`,
      },
      { property: 'article:published_time', content: composition.createdAt },
      { property: 'article:modified_time', content: composition.updatedAt },
      { property: 'article:section', content: 'Music Composition' },
      // Canonical URL
      {
        tagName: 'link',
        rel: 'canonical',
        href: `https://rasika.life${generateCompositionUrl(composition.title, composition.id)}`,
      },
      // Breadcrumb structured data for SEO
      {
        'script:ld+json': {
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
              item: `https://rasika.life${generateCompositionUrl(composition.title, composition.id)}`,
            },
          ],
        },
      },
      // MusicComposition structured data
      {
        'script:ld+json': {
          '@context': 'https://schema.org',
          '@type': 'MusicComposition',
          name: composition.title,
          composer: {
            '@type': 'Person',
            name: composition.composer.name,
          },
          inLanguage: composition.language,
        },
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

export const links: LinksFunction = () => {
  return [
    // Canonical URL will be added in meta function as tagName: 'link'
  ];
};

export default function CompositionDetails() {
  const {
    composition,
    relatedCompositionsByComposer,
    hasMoreCompositionsByComposer,
    relatedCompositionsByRaga,
    hasMoreCompositionsByRaga,
    relatedCompositionsByTala,
    hasMoreCompositionsByTala,
  } = useLoaderData<{
    composition: CompositionWithRelations;
    relatedCompositionsByComposer: CompositionWithRelations[];
    hasMoreCompositionsByComposer: boolean;
    relatedCompositionsByRaga: CompositionWithRelations[];
    hasMoreCompositionsByRaga: boolean;
    relatedCompositionsByTala: CompositionWithRelations[];
    hasMoreCompositionsByTala: boolean;
  }>();

  const shareUrl = `https://rasika.life${generateCompositionUrl(composition.title, composition.id)}`;

  const breadcrumbItems = [
    { label: 'Home', path: '/' },
    { label: 'Carnatic', path: '/carnatic' },
    { label: 'Compositions', path: '/carnatic/compositions' },
    {
      label: composition.title,
      path: generateCompositionUrl(composition.title, composition.id),
    },
  ];

  return (
    <div className="max-w-4xl m-auto">
      {/* Structured Data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
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
                item: `https://rasika.life${generateCompositionUrl(composition.title, composition.id)}`,
              },
            ],
          }),
        }}
      />

      <Breadcrumb items={breadcrumbItems} />
      <header className="mb-8">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h1 className="text-4xl font-bold">{composition.title}</h1>
          </div>
          <ShareButtons
            url={shareUrl}
            title={`${composition.title} - ${composition.composer.name}`}
            description={`Indian classical ${composition.language} composition by ${composition.composer.name}`}
          />
        </div>
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
          <p>
            <strong>Ragas:</strong>{' '}
            {composition.ragas && composition.ragas.length > 0 ? (
              composition.ragas.map((raga, index) => (
                <span key={raga.id}>
                  {index > 0 && ', '}
                  <Link
                    to={`/carnatic/ragas/${raga.name.toLowerCase().replace(/\s+/g, '-')}-${raga.id}`}
                    className="text-primary hover:underline"
                  >
                    {raga.name}
                  </Link>
                </span>
              ))
            ) : (
              <span className="text-muted-foreground">unknown</span>
            )}
          </p>
          <p>
            <strong>Talas:</strong>{' '}
            {composition.talas && composition.talas.length > 0 ? (
              composition.talas.map((tala, index) => (
                <span key={tala.id}>
                  {index > 0 && ', '}
                  <Link
                    to={`/carnatic/talas/${tala.name.toLowerCase().replace(/\s+/g, '-')}-${tala.id}`}
                    className="text-primary hover:underline"
                  >
                    {tala.name}
                  </Link>
                </span>
              ))
            ) : (
              <span className="text-muted-foreground">unknown</span>
            )}
          </p>
          {composition.sourceAttribution && (
            <p>
              <strong>Source:</strong>{' '}
              <a
                href={composition.sourceAttribution}
                target="_blank"
                rel="nofollow noreferrer"
                className="text-primary hover:underline"
              >
                {composition.sourceAttribution}
              </a>
            </p>
          )}
        </div>
      </section>
      {composition.lyricsV1 && composition.lyricsV1.length > 0 && (
        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Lyrics</h2>
          <div className="space-y-4">
            {composition.lyricsV1.map((lyric: any, index: number) => (
              <div key={index} className="p-4 bg-muted rounded-lg">
                {lyric.type && (
                  <h3 className="text-lg font-semibold mb-2 capitalize">{lyric.type}</h3>
                )}
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
            customHeading={`More compositions in ${composition.ragas[0].name}`}
          />
        )}
      <section className="mt-12 pt-8 border-t">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link
            to="/carnatic/compositions"
            className="p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors text-center"
          >
            <h3 className="font-medium">Browse All Compositions</h3>
            <p className="text-sm text-muted-foreground">Explore the collection</p>
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

      {/* Structured Data for SEO */}
      <BreadcrumbStructuredData
        items={[
          { name: 'Home', item: 'https://rasika.life' },
          { name: 'Carnatic', item: 'https://rasika.life/carnatic' },
          { name: 'Compositions', item: 'https://rasika.life/carnatic/compositions' },
          {
            name: composition.title,
            item: `https://rasika.life${generateCompositionUrl(composition.title, composition.id)}`,
          },
        ]}
      />
      <MusicCompositionStructuredData
        composition={{
          title: composition.title,
          composer: composition.composer,
          ragas: composition.ragas,
          talas: composition.talas,
          language: composition.language,
          url: `https://rasika.life${generateCompositionUrl(composition.title, composition.id)}`,
          datePublished: composition.createdAt,
        }}
      />
    </div>
  );
}
