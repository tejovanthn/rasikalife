import type { CompositionWithRelations } from '@rasika/core/types/entities';
import { type LoaderFunction, type MetaFunction, data } from 'react-router';
import { Link, useLoaderData, useLocation, useNavigate, useSearchParams } from 'react-router';
import { client } from '~/api.server';
import { CompositionCard } from '~/components/CompositionCard';
import { EntityPagination } from '~/components/EntityPagination';
import { EmptyState } from '~/components/shared/EmptyState';
import { ApplicationError, ErrorCode } from '~/lib/errors';
import { generateArtistUrl, parseSlug } from '~/lib/url-slug';

export const meta: MetaFunction = ({ data }) => {
  const loaderData = data as { artist: { id: string; name: string } } | undefined;
  if (!loaderData) return [{ title: 'Compositions - Rasika.life' }];
  const { artist } = loaderData;
  const canonicalUrl = `https://rasika.life${generateArtistUrl(artist.name, artist.id)}/compositions`;
  return [
    { title: `Compositions by ${artist.name} - Rasika.life` },
    {
      name: 'description',
      content: `Browse all compositions by ${artist.name} in Indian classical music.`,
    },
    { tagName: 'link', rel: 'canonical', href: canonicalUrl },
  ];
};

export const loader: LoaderFunction = async ({ params, request }) => {
  const { artistid } = params;

  if (!artistid) {
    throw new Response('Artist ID is required', { status: 400 });
  }

  const url = new URL(request.url);
  const nextToken = url.searchParams.get('nextToken');
  const itemsPerPage = 36;

  const parsed = parseSlug(artistid);

  if (!parsed) {
    throw new Response('Invalid URL format', { status: 400 });
  }

  const slugId = parsed.id;

  try {
    const artist = await client.artist.get.query({ id: slugId });

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
    if (error instanceof ApplicationError) {
      if (error.code === ErrorCode.ARTIST_NOT_FOUND) {
        throw new Response(error.message, { status: 404 });
      }
      // Handle other error codes as needed
    }
    throw new Response('Failed to load compositions', { status: 500 });
  }
};

export default function ArtistCompositions() {
  const location = useLocation();

  const { artist, compositions, hasMore, nextToken, prevToken } = useLoaderData<{
    artist: { id: string; name: string };
    compositions: CompositionWithRelations[];
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
          to={generateArtistUrl(artist.name, artist.id)}
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
