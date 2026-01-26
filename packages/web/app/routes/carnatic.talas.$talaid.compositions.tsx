import type { CompositionType } from '@rasika/core/types/entities';
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
  const { talaid } = params;

  if (!talaid) {
    throw new Response('Tala ID is required', { status: 400 });
  }

  const url = new URL(request.url);
  const nextToken = url.searchParams.get('nextToken');
  const itemsPerPage = 36;

  const slugId = talaid.split('-').pop();

  if (!slugId) {
    throw new Response('Invalid URL format', { status: 400 });
  }

  try {
    const tala = await client.tala.get.query({ id: slugId });

    if (!tala) {
      throw new Response('Tala not found', { status: 404 });
    }

    const result = await client.composition.byTala.query({
      talaId: tala.id,
      limit: itemsPerPage,
      nextToken: nextToken || undefined,
    });

    return data({
      tala,
      compositions: result.items,
      hasMore: result.hasMore,
      nextToken: result.nextToken,
      prevToken: nextToken,
    });
  } catch (error) {
    console.error('Failed to load tala compositions:', error);
    if (error instanceof ApplicationError) {
      if (error.code === ErrorCode.TALA_NOT_FOUND) {
        throw new Response(error.message, { status: 404 });
      }
      // Handle other error codes as needed
    }
    throw new Response('Failed to load compositions', { status: 500 });
  }
};

export default function TalaCompositions() {
  const location = useLocation();
  const { talaid } = useParams();

  const { tala, compositions, hasMore, nextToken, prevToken } = useLoaderData<{
    tala: { id: string; name: string };
    compositions: CompositionType[];
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
          to={`/carnatic/talas/${tala.name.toLowerCase().replace(/\s+/g, '-')}-${tala.id}`}
          className="text-primary hover:underline mb-2 inline-block"
        >
          ← Back to {tala.name}
        </Link>
        <h1 className="text-3xl font-bold">Compositions in {tala.name}</h1>
        <p className="text-muted-foreground mt-2">All compositions performed in {tala.name} tala</p>
      </div>
      {!compositions.length ? (
        <EmptyState
          message="No compositions found"
          description={`There are no compositions in ${tala.name} tala in our database yet.`}
        />
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {compositions.map(composition => (
              <CompositionCard key={composition.id} composition={composition} showTalas={false} />
            ))}
          </div>

          <EntityPagination
            currentPage={currentPage}
            hasMore={hasMore}
            nextToken={nextToken}
            baseUrl={`/carnatic/talas/${talaid}/compositions`}
          />
        </>
      )}
    </div>
  );
}
