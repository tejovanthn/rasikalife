import type { TalaType } from '@rasika/core/types/entities';
import { fromItrans } from '@rasika/core/utils';
import { data } from 'react-router';
import type { LoaderFunction, MetaFunction } from 'react-router';
import { Link, useLoaderData, useSearchParams } from 'react-router';
import { client } from '~/api.server';
import { EntityPagination } from '~/components/EntityPagination';
import { TalaCard } from '~/components/TalaCard';
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
      const results = await client.search.search.query({
        query,
        limit: itemsPerPage,
        offset: nextToken ? Number.parseInt(nextToken, 10) : 0,
      });

      return data({
        talas: results.items
          .filter(item => item.type === 'tala')
          .map(item => ({
            id: item.id,
            name: fromItrans(item.name, script),
            aksharas: 0,
            description: '',
            viewCount: 0,
            createdAt: '',
            updatedAt: '',
          })),
        nextToken: null,
        hasMore: false,
        prevToken: null,
        searchQuery: query,
      });
    }

    const results = await client.tala.list.query({
      limit: itemsPerPage,
      nextToken: nextToken || undefined,
    });

    return data({
      talas: (results.items || [])
        .slice(0, 12)
        .map(t => ({ ...t, name: fromItrans(t.name, script) })),
      nextToken: results.nextToken,
      hasMore: results.hasMore,
      prevToken: nextToken,
      searchQuery: null,
    });
  } catch (error) {
    console.error('Failed to load talas:', error);
    throw new Response('Failed to load talas', { status: 500 });
  }
};

export const meta: MetaFunction = () => {
  return [
    { title: 'Talas - Indian Classical Music - Rasika.life' },
    {
      name: 'description',
      content:
        'Explore traditional Indian classical talas. Discover the rhythmic foundations and time cycles of Carnatic music.',
    },
    {
      name: 'keywords',
      content:
        'Indian classical talas, Carnatic talas, rhythmic cycles, classical music rhythm, tala music, time cycles',
    },
    { tagName: 'link', rel: 'canonical', href: 'https://rasika.life/carnatic/talas' },
  ];
};

export default function TalasIndex() {
  const { talas, nextToken, hasMore, prevToken, searchQuery } = useLoaderData<{
    talas: TalaType[];
    nextToken: string | null;
    hasMore: boolean;
    prevToken: string | null;
    searchQuery: string | null;
  }>();

  const [searchParams] = useSearchParams();
  const currentPage = Number.parseInt(searchParams.get('page') || '1', 10);

  return (
    <main className="container mx-auto px-4 py-8 max-w-6xl">
      <header className="mb-8">
        <h1 className="page-title">Talas</h1>
        {searchQuery ? (
          <p className="text-xl text-muted-foreground">Search results for "{searchQuery}"</p>
        ) : (
          <p className="text-xl text-muted-foreground">
            Explore traditional Indian classical talas
          </p>
        )}
      </header>

      {talas.length === 0 ? (
        <EmptyState message="No talas available at the moment." />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
            {talas.map(tala => (
              <TalaCard key={tala.id} tala={tala} />
            ))}
          </div>

          <EntityPagination
            currentPage={currentPage}
            hasMore={hasMore}
            nextToken={nextToken}
            prevToken={prevToken}
            baseUrl="/carnatic/talas"
          />
        </>
      )}
      <BreadcrumbStructuredData
        items={[
          { name: 'Home', item: 'https://rasika.life' },
          { name: 'Carnatic', item: 'https://rasika.life/carnatic' },
          { name: 'Talas', item: 'https://rasika.life/carnatic/talas' },
        ]}
      />
    </main>
  );
}
