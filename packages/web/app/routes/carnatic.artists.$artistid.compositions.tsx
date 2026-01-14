import { type LoaderFunction, data } from 'react-router';
import { Link, useLoaderData, useLocation, useNavigate, useSearchParams } from 'react-router';
import { client } from '~/api.server';
import { CompositionCard } from '~/components/CompositionCard';
import { EntityPagination } from '~/components/EntityPagination';
import { EmptyState } from '~/components/shared/EmptyState';

export const loader: LoaderFunction = async ({ params, request }) => {
  const { artistid } = params;

  if (!artistid) {
    throw new Response('Artist ID is required', { status: 400 });
  }

  const url = new URL(request.url);
  const nextToken = url.searchParams.get('nextToken');
  const itemsPerPage = 36;

  const slugId = artistid.split('-').pop();

  if (!slugId) {
    throw new Response('Invalid URL format', { status: 400 });
  }

  try {
    const artist = await client.artist.get.query({ id: slugId });

    if (!artist) {
      throw new Response('Artist not found', { status: 404 });
    }

    // Get compositions by this artist with pagination
    const result = await client.composition.byComposer.query({
      composerId: artist.id,
      limit: itemsPerPage,
      nextToken: nextToken || undefined,
    });

    return data({
      artist,
      compositions: result.items,
      hasMore: result.hasMore,
      nextToken: result.nextToken,
      prevToken: nextToken,
    });
  } catch (error) {
    console.error('Failed to load artist compositions:', error);
    throw new Response('Failed to load compositions', { status: 500 });
  }
};

export default function ArtistCompositions() {
  const location = useLocation();

  const { artist, compositions, hasMore, nextToken, prevToken } = useLoaderData<{
    artist: { id: string; name: string };
    compositions: any[];
    hasMore: boolean;
    nextToken: string | null;
    prevToken: string | null;
  }>();

  const [searchParams] = useSearchParams();
  const currentPage = Number.parseInt(searchParams.get('page') || '1', 10);
  const prevPageToken = searchParams.get('prevToken');

  return (
    <main className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <Link
          to={`/carnatic/artists/${artist.name.toLowerCase().replace(/\s+/g, '-')}-${artist.id}`}
          className="text-primary hover:underline mb-2 inline-block"
        >
          ← Back to {artist.name}
        </Link>
        <h1 className="text-3xl font-bold">Compositions by {artist.name}</h1>
        <p className="text-muted-foreground mt-2">All compositions composed by {artist.name}</p>
      </div>
      {!compositions.length ? (
        <EmptyState
          message="No compositions found"
          description={`${artist.name} doesn't have any compositions in our database yet.`}
        />
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {compositions.map(composition => (
              <CompositionCard
                key={composition.id}
                composition={composition}
                showComposer={false}
              />
            ))}
          </div>

          <EntityPagination
            currentPage={currentPage}
            hasMore={hasMore}
            nextToken={nextToken}
            prevToken={prevToken}
          />
        </>
      )}
    </main>
  );
}
