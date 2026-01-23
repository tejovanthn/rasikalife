import type { CompositionWithRelations } from '@rasika/core/types/entities';
import { type LoaderFunction, data } from 'react-router';
import {
  Link,
  useLoaderData,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router';
import { client } from '~/api.server';
import { CompositionCard } from '~/components/CompositionCard';
import { EntityPagination } from '~/components/EntityPagination';
import { EmptyState } from '~/components/shared/EmptyState';
import { ApplicationError, ErrorCode } from '~/lib/errors';

export const loader: LoaderFunction = async ({ params, request }) => {
  const { ragaid } = params;

  if (!ragaid) {
    throw new Response('Raga ID is required', { status: 400 });
  }

  const url = new URL(request.url);
  const nextToken = url.searchParams.get('nextToken');
  const itemsPerPage = 36;

  const slugId = ragaid.split('-').pop();

  if (!slugId) {
    throw new Response('Invalid URL format', { status: 400 });
  }

  try {
    const raga = await client.raga.get.query({ id: slugId });

    const result = await client.composition.byRaga.query({
      ragaId: raga.id,
      limit: itemsPerPage,
      nextToken: nextToken || undefined,
    });

    return data({
      raga,
      compositions: result.items,
      hasMore: result.hasMore,
      nextToken: result.nextToken,
      prevToken: nextToken,
    });
  } catch (error) {
    console.error('Failed to load raga compositions:', error);
    if (error instanceof ApplicationError) {
      if (error.code === ErrorCode.RAGA_NOT_FOUND) {
        throw new Response(error.message, { status: 404 });
      }
      // Handle other error codes as needed
    }
    throw new Response('Failed to load compositions', { status: 500 });
  }
};

export default function RagaCompositions() {
  const location = useLocation();
  const { ragaid } = useParams();

  const { raga, compositions, hasMore, nextToken, prevToken } = useLoaderData<{
    raga: { id: string; name: string };
    compositions: CompositionWithRelations[];
    hasMore: boolean;
    nextToken: string | null;
    prevToken: string | null;
  }>();

  const [searchParams] = useSearchParams();
  const currentPage = Number.parseInt(searchParams.get('page') || '1', 10);

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <Link
          to={`/carnatic/ragas/${raga.name.toLowerCase().replace(/\s+/g, '-')}-${raga.id}`}
          className="text-primary hover:underline mb-2 inline-block"
        >
          ← Back to {raga.name}
        </Link>
        <h1 className="text-3xl font-bold">Compositions in {raga.name}</h1>
        <p className="text-muted-foreground mt-2">
          All compositions performed in the {raga.name} raga
        </p>
      </div>
      {!compositions.length ? (
        <EmptyState
          message="No compositions found"
          description={`There are no compositions in the ${raga.name} raga in our database yet.`}
        />
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {compositions.map(composition => (
              <CompositionCard key={composition.id} composition={composition} showRagas={false} />
            ))}
          </div>

          <EntityPagination
            currentPage={currentPage}
            hasMore={hasMore}
            nextToken={nextToken}
            baseUrl={`/carnatic/ragas/${ragaid}/compositions`}
          />
        </>
      )}
    </div>
  );
}
