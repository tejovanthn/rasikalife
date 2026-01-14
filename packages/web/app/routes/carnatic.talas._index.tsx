import { type LoaderFunction, type MetaFunction, json } from 'react-router';
import { Link, useLoaderData, useSearchParams } from 'react-router';
import { client } from '~/api.server';
import { EntityPagination } from '~/components/EntityPagination';
import { TalaCard } from '~/components/TalaCard';
import { EmptyState } from '~/components/shared/EmptyState';

// Tala type from @rasika/core domain/tala
type Tala = {
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
    const results = await client.tala.list.query({
      limit: itemsPerPage,
      nextToken: nextToken || undefined,
    });

    return data({
      talas: (results.items || []).slice(0, 12),
      nextToken: results.nextToken,
      hasMore: results.hasMore,
      prevToken: nextToken,
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
  ];
};

export default function TalasIndex() {
  const { talas, nextToken, hasMore, prevToken } = useLoaderData<{
    talas: Tala[];
    nextToken: string | null;
    hasMore: boolean;
    prevToken: string | null;
  }>();

  const [searchParams] = useSearchParams();
  const currentPage = Number.parseInt(searchParams.get('page') || '1', 10);

  return (
    <main className="container mx-auto px-4 py-8 max-w-6xl">
      <header className="mb-8">
        <h1 className="page-title">Talas</h1>
        <p className="text-xl text-muted-foreground">Explore traditional Indian classical talas</p>
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
    </main>
  );
}

export function ErrorBoundary() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-red-600">Something went wrong</h1>
      <p className="text-muted-foreground">
        We're having trouble loading the talas. Please try again later.
      </p>
      <Link to="/carnatic/talas" className="text-blue-600 hover:underline">
        Back to Talas
      </Link>
    </div>
  );
}
