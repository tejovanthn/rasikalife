import type { ArtistType } from '@rasika/core/types/entities';
import { fromItrans } from '@rasika/core/utils';
import { data } from 'react-router';
import type { LoaderFunction, MetaFunction } from 'react-router';
import { Link, useLoaderData, useSearchParams } from 'react-router';
import { client } from '~/api.server';
import { ArtistCard } from '~/components/ArtistCard';
import { EntityPagination } from '~/components/EntityPagination';
import { EmptyState } from '~/components/shared/EmptyState';
import { ApplicationError } from '~/lib/errors';
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
        artists: results.items
          .filter(item => item.type === 'artist')
          .map(item => ({
            id: item.id,
            name: fromItrans(item.name, script),
            artistType: 'vocalist' as const,
            traditions: [],
            isVerified: false,
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

    const results = await client.artist.list.query({
      limit: itemsPerPage,
      nextToken: nextToken || undefined,
    });

    return data({
      artists: (results.items || [])
        .slice(0, 12)
        .map(a => ({ ...a, name: fromItrans(a.name, script) })),
      nextToken: results.nextToken,
      hasMore: results.hasMore,
      prevToken: nextToken,
      searchQuery: null,
    });
  } catch (error) {
    console.error('Failed to load artists:', error);
    if (error instanceof ApplicationError) {
      throw new Response(error.message, { status: 500 });
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
    { tagName: 'link', rel: 'canonical', href: 'https://rasika.life/artists' },
  ];
};

export default function ArtistsIndex() {
  const { artists, nextToken, hasMore, searchQuery } = useLoaderData<{
    artists: ArtistType[];
    nextToken: string | null;
    hasMore: boolean;
    searchQuery: string | null;
  }>();

  const [searchParams] = useSearchParams();
  const currentPage = Number.parseInt(searchParams.get('page') || '1', 10);

  return (
    <main className="container mx-auto px-4 py-8 max-w-6xl">
      <header className="mb-8">
        <h1 className="page-title">Artists</h1>
        {searchQuery ? (
          <p className="text-xl text-muted-foreground">Search results for "{searchQuery}"</p>
        ) : (
          <p className="text-xl text-muted-foreground">
            Explore renowned artists of Indian classical music
          </p>
        )}
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
            baseUrl="/artists"
          />
        </>
      )}
    </main>
  );
}
