import type { RagaType } from '@rasika/core/types/entities';
import { fromItrans } from '@rasika/core/utils/transliteration';
import { data } from 'react-router';
import type { LoaderFunction, MetaFunction } from 'react-router';
import { Link, useLoaderData, useSearchParams } from 'react-router';
import { client } from '~/api.server';
import { EntityPagination } from '~/components/EntityPagination';
import { MelakartaWheel } from '~/components/MelakartaWheel';
import { RagaCard } from '~/components/RagaCard';
import { EmptyState } from '~/components/shared/EmptyState';
import { BreadcrumbStructuredData } from '~/components/structured-data';
import { titleCaseName } from '~/lib/utils';
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
        ragas: results.items
          .filter(item => item.type === 'raga')
          .map(item => ({
            id: item.id,
            name: titleCaseName(fromItrans(item.name, script)),
            melakarta: 0,
            parentId: null,
            arkarkams: [],
            janyaOf: null,
            Arohana: [],
            Avarohana: [],
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

    const results = await client.raga.list.query({
      limit: itemsPerPage,
      nextToken: nextToken || undefined,
    });

    return data({
      ragas: (results.items || []).map(r => ({
        ...r,
        name: titleCaseName(fromItrans(r.name, script)),
      })),
      nextToken: results.nextToken,
      hasMore: results.hasMore,
      prevToken: nextToken,
      searchQuery: null,
    });
  } catch (error) {
    console.error('Failed to load ragas:', error);
    throw new Response('Failed to load ragas', { status: 500 });
  }
};

export const meta: MetaFunction = () => {
  return [
    { title: 'Ragas - Indian Classical Music - Rasika.life' },
    {
      name: 'description',
      content:
        'Explore traditional Indian classical ragas. Discover the melodic foundations of Carnatic and Hindustani music traditions.',
    },
    {
      name: 'keywords',
      content:
        'Indian classical ragas, Carnatic ragas, Hindustani ragas, melodic modes, classical music scales, raga music',
    },
    { tagName: 'link', rel: 'canonical', href: 'https://rasika.life/carnatic/ragas' },
  ];
};

export default function RagasIndex() {
  const { ragas, nextToken, hasMore, searchQuery } = useLoaderData<{
    ragas: RagaType[];
    nextToken: string | null;
    hasMore: boolean;
    searchQuery: string | null;
  }>();

  const [searchParams] = useSearchParams();
  const currentPage = Number.parseInt(searchParams.get('page') || '1', 10);

  return (
    <main className="container mx-auto px-4 py-8 max-w-6xl">
      <header className="mb-8">
        <h1 className="page-title">Ragas</h1>
        {searchQuery ? (
          <p className="text-xl text-muted-foreground">Search results for "{searchQuery}"</p>
        ) : (
          <p className="text-xl text-muted-foreground">
            Explore traditional Indian classical ragas
          </p>
        )}
      </header>

      <MelakartaWheel />

      {ragas.length === 0 ? (
        <EmptyState message="No ragas available at the moment." />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
            {ragas.map(raga => (
              <RagaCard key={raga.id} raga={raga} />
            ))}
          </div>

          <EntityPagination
            currentPage={currentPage}
            hasMore={hasMore}
            nextToken={nextToken}
            baseUrl="/carnatic/ragas"
          />
        </>
      )}
      <BreadcrumbStructuredData
        items={[
          { name: 'Home', item: 'https://rasika.life' },
          { name: 'Carnatic', item: 'https://rasika.life/carnatic' },
          { name: 'Ragas', item: 'https://rasika.life/carnatic/ragas' },
        ]}
      />
    </main>
  );
}
