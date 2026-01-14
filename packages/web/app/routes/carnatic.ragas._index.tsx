import { type LoaderFunction, type MetaFunction, json } from 'react-router';
import { Link, useLoaderData, useSearchParams } from 'react-router';
import { client } from '~/api.server';
import { RagaCard } from '~/components/RagaCard';
import { EmptyState } from '~/components/shared/EmptyState';
import { EntityPagination } from '~/components/EntityPagination';

// Raga type from @rasika/core domain/raga
type Raga = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const nextToken = url.searchParams.get('nextToken');
  const itemsPerPage = 36;

  try {
    const results = await client.raga.list.query({
      limit: itemsPerPage,
      nextToken: nextToken || undefined,
    });

    return data({
      ragas: (results.items || []).slice(0, 12),
      nextToken: results.nextToken,
      hasMore: results.hasMore,
      prevToken: nextToken,
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
  ];
};

export default function RagasIndex() {
  const { ragas, nextToken, hasMore } = useLoaderData<{
    ragas: Raga[];
    nextToken: string | null;
    hasMore: boolean;
  }>();

  const [searchParams] = useSearchParams();
  const currentPage = Number.parseInt(searchParams.get('page') || '1', 10);

  return (
    <main className="container mx-auto px-4 py-8 max-w-6xl">
      <header className="mb-8">
        <h1 className="page-title">Ragas</h1>
        <p className="text-xl text-muted-foreground">Explore traditional Indian classical ragas</p>
      </header>

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
    </main>
  );
}

export function ErrorBoundary() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-red-600">Something went wrong</h1>
      <p className="text-muted-foreground">
        We're having trouble loading the ragas. Please try again later.
      </p>
      <Link to="/carnatic/ragas" className="text-blue-600 hover:underline">
        Back to Ragas
      </Link>
    </div>
  );
}
