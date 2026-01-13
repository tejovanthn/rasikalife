import { type LoaderFunction, type MetaFunction, json } from '@remix-run/node';
import { Link, useLoaderData, useSearchParams } from '@remix-run/react';
import { client } from '~/api.server';
import { CompositionCard } from '~/components/CompositionCard';
import { EmptyState } from '~/components/shared/EmptyState';
import { EntityPagination } from '~/components/EntityPagination';

// Composition type from @rasika/core domain/composition
type Composition = {
  id: string;
  title: string;
  composer: {
    id: string;
    name: string;
  };
  language: string;
  createdAt: string;
  updatedAt: string;
};

export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const nextToken = url.searchParams.get('nextToken');
  const itemsPerPage = 36;

  try {
    const results = await client.composition.list.query({
      limit: itemsPerPage,
      nextToken: nextToken || undefined,
    });

    return json({
      compositions: results.items || [],
      nextToken: results.nextToken,
      hasMore: results.hasMore,
      prevToken: nextToken,
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
  ];
};

export default function CompositionsIndex() {
  const { compositions, nextToken, hasMore, prevToken } = useLoaderData<{
    compositions: Composition[];
    nextToken: string | null;
    hasMore: boolean;
    prevToken: string | null;
  }>();

  const [searchParams] = useSearchParams();
  const currentPage = Number.parseInt(searchParams.get('page') || '1', 10);
  const prevPageToken = searchParams.get('prevToken');

  return (
    <div className="max-w-6xl">
      <header className="mb-8">
        <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl mb-4">
          Compositions
        </h1>
        <p className="text-xl text-muted-foreground">
          Explore traditional Indian classical music compositions
        </p>
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
            baseUrl="/carnatic/compositions"
          />
        </>
      )}
    </div>
  );
}
