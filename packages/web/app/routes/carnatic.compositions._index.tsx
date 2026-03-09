import type { CompositionWithRelations } from '@rasika/core/types/entities';
import { fromItrans } from '@rasika/core/utils';
import { data } from 'react-router';
import type { LoaderFunction, MetaFunction } from 'react-router';
import { Link, useLoaderData, useSearchParams } from 'react-router';
import { client } from '~/api.server';
import { CompositionCard } from '~/components/CompositionCard';
import { EntityPagination } from '~/components/EntityPagination';
import { EmptyState } from '~/components/shared/EmptyState';
import { BreadcrumbStructuredData } from '~/components/structured-data';
import { scriptSessionResolver } from '~/sessions.server';

export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const nextToken = url.searchParams.get('nextToken');
  const query = url.searchParams.get('q');
  const itemsPerPage = 36;
  const script = await scriptSessionResolver.getScript(request);

  try {
    if (query) {
      // Use searchWithFullData to get enriched results in a single request
      const searchResults = await client.search.searchWithFullData.query({
        query,
        limit: itemsPerPage,
        offset: 0,
        filters: ['compositionTitle', 'lyrics'],
      });

      return data({
        compositions: searchResults.compositions.map(c => ({
          ...c,
          title: fromItrans(c.title, script),
          composer: { ...c.composer, name: fromItrans(c.composer.name, script) },
        })),
        nextToken: null,
        hasMore: searchResults.compositions.length >= itemsPerPage,
        prevToken: null,
        searchQuery: query,
      });
    }

    const results = await client.composition.list.query({
      limit: itemsPerPage,
      nextToken: nextToken || undefined,
    });

    return data({
      compositions: (results.items || []).map(c => ({
        ...c,
        title: fromItrans(c.title, script),
        composer: { ...c.composer, name: fromItrans(c.composer.name, script) },
      })),
      nextToken: results.nextToken,
      hasMore: results.hasMore,
      prevToken: nextToken,
      searchQuery: null,
    });
  } catch (error) {
    console.error('Failed to load compositions:', error);
    throw new Response('Failed to load compositions', { status: 500 });
  }
};

export const meta: MetaFunction = () => {
  return [
    { title: 'Compositions - Indian Classical Music - Rasika.life' },
    {
      name: 'description',
      content:
        'Explore traditional Indian classical music compositions. Discover Carnatic and Hindustani musical works with lyrics and musical analysis.',
    },
    {
      name: 'keywords',
      content:
        'Indian classical compositions, Carnatic music, Hindustani compositions, traditional music, classical works, musical compositions',
    },
    { tagName: 'link', rel: 'canonical', href: 'https://rasika.life/carnatic/compositions' },
  ];
};

export default function CompositionsIndex() {
  const { compositions, nextToken, hasMore, prevToken, searchQuery } = useLoaderData<{
    compositions: CompositionWithRelations[];
    nextToken: string | null;
    hasMore: boolean;
    prevToken: string | null;
    searchQuery: string | null;
  }>();

  const [searchParams] = useSearchParams();
  const currentPage = Number.parseInt(searchParams.get('page') || '1', 10);
  const prevPageToken = searchParams.get('prevToken');

  return (
    <div className="max-w-6xl">
      <header className="mb-8">
        <h1 className="page-title">Compositions</h1>
        {searchQuery ? (
          <p className="text-xl text-muted-foreground">Search results for "{searchQuery}"</p>
        ) : (
          <p className="text-xl text-muted-foreground">
            Explore traditional Indian classical music compositions
          </p>
        )}
      </header>

      {compositions.length === 0 ? (
        <EmptyState message="No compositions available at the moment." />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
            {compositions.map(composition => (
              <CompositionCard key={composition.id} composition={composition} />
            ))}
          </div>

          <EntityPagination
            currentPage={currentPage}
            hasMore={hasMore}
            nextToken={nextToken}
            prevToken={prevToken}
            baseUrl="/carnatic/compositions"
          />
        </>
      )}
      <BreadcrumbStructuredData
        items={[
          { name: 'Home', item: 'https://rasika.life' },
          { name: 'Carnatic', item: 'https://rasika.life/carnatic' },
          { name: 'Compositions', item: 'https://rasika.life/carnatic/compositions' },
        ]}
      />
    </div>
  );
}
