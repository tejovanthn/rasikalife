import { ApplicationError } from '@rasika/core';
import type { ArtistType } from '@rasika/core/types/entities';
import { data } from 'react-router';
import type { LoaderFunction, MetaFunction } from 'react-router';
import { Link, useLoaderData, useSearchParams } from 'react-router';
import { client } from '~/api.server';
import { ArtistCard } from '~/components/ArtistCard';
import { EntityPagination } from '~/components/EntityPagination';
import { EmptyState } from '~/components/shared/EmptyState';

export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const nextToken = url.searchParams.get('nextToken');
  const itemsPerPage = 36;

  try {
    const results = await client.artist.list.query({
      limit: itemsPerPage,
      nextToken: nextToken || undefined,
    });

    return data({
      artists: (results.items || []).slice(0, 12),
      nextToken: results.nextToken,
      hasMore: results.hasMore,
      prevToken: nextToken,
    });
  } catch (error) {
    console.error('Failed to load artists:', error);
    if (error instanceof ApplicationError) {
      throw new Response(error.message, { status: 500 }); // Keep 500 for now, could map to specific codes later
    }
    throw new Response('Failed to load artists', { status: 500 });
  }
};

export const meta: MetaFunction = () => {
  return [
    { title: 'Artists - Indian Classical Music - Rasika.life' },
    {
      name: 'description',
      content:
        'Explore renowned artists of Indian classical music. Discover their biographies, musical styles, and contributions to classical traditions.',
    },
    {
      name: 'keywords',
      content:
        'Indian classical music artists, Carnatic musicians, Hindustani artists, classical musicians, maestros, vocalists, instrumentalists',
    },
  ];
};

export default function ArtistsIndex() {
  const { artists, nextToken, hasMore } = useLoaderData<{
    artists: ArtistType[];
    nextToken: string | null;
    hasMore: boolean;
  }>();

  const [searchParams] = useSearchParams();
  const currentPage = Number.parseInt(searchParams.get('page') || '1', 10);

  return (
    <main className="container mx-auto px-4 py-8 max-w-6xl">
      <header className="mb-8">
        <h1 className="page-title">Artists</h1>
        <p className="text-xl text-muted-foreground">
          Explore renowned artists of Indian classical music
        </p>
      </header>

      {artists.length === 0 ? (
        <EmptyState message="No artists available at the moment." />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
            {artists.map(artist => (
              <ArtistCard key={artist.id} artist={artist} />
            ))}
          </div>

          <EntityPagination
            currentPage={currentPage}
            hasMore={hasMore}
            nextToken={nextToken}
            baseUrl="/carnatic/artists"
          />
        </>
      )}
    </main>
  );
}
