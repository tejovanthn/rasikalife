import type { ArtistType } from '@rasika/core/types/entities';
import { data } from 'react-router';
import type { LoaderFunction, MetaFunction } from 'react-router';
import { Link, useLoaderData, useSearchParams } from 'react-router';
import { client } from '~/api.server';
import { ArtistCard } from '~/components/ArtistCard';
import { EntityPagination } from '~/components/EntityPagination';
import { FilterLink } from '~/components/filter-link';
import { EmptyState } from '~/components/shared/EmptyState';
import { BreadcrumbStructuredData } from '~/components/structured-data';
import { buttonVariants } from '~/components/ui/button';
import { ApplicationError } from '~/lib/errors';
import { cn } from '~/lib/utils';

export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const nextToken = url.searchParams.get('nextToken');
  const query = url.searchParams.get('q');
  const sort = url.searchParams.get('sort') === 'popular' ? 'popular' : null;
  const verifiedOnly = url.searchParams.get('verified') === '1';
  const page = Math.max(1, Number.parseInt(url.searchParams.get('page') || '1', 10) || 1);
  const itemsPerPage = 36;

  try {
    // Popular and Verified are ranked from the search index (derived popularity and the
    // verified flag live there); the plain listing keeps its own pagination.
    if (!query && (sort || verifiedOnly)) {
      const results = await client.artist.browse.query({
        sort: sort ?? 'name',
        verifiedOnly,
        page,
        limit: itemsPerPage,
      });
      return data({
        artists: results.items,
        nextToken: null,
        hasMore: results.hasMore,
        prevToken: null,
        searchQuery: null,
        browse: { sort, verifiedOnly, page, verifiedCount: results.verifiedCount },
      });
    }
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
            name: item.name,
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

    const [results, counts] = await Promise.all([
      client.artist.list.query({
        limit: itemsPerPage,
        nextToken: nextToken || undefined,
      }),
      // Only to learn whether any artist is verified, so the filter is never offered empty.
      client.artist.browse
        .query({ sort: 'name', page: 1, limit: 1 })
        .catch(() => null),
    ]);

    return data({
      artists: results.items || [],
      nextToken: results.nextToken,
      hasMore: results.hasMore,
      prevToken: nextToken,
      searchQuery: null,
      browse: { sort: null, verifiedOnly: false, page, verifiedCount: counts?.verifiedCount ?? 0 },
    });
  } catch (error) {
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

interface BrowseState {
  sort: 'popular' | null;
  verifiedOnly: boolean;
  page: number;
  verifiedCount: number;
}

function browseHref(state: { sort: 'popular' | null; verifiedOnly: boolean; page?: number }) {
  const q = new URLSearchParams();
  if (state.sort) q.set('sort', state.sort);
  if (state.verifiedOnly) q.set('verified', '1');
  if (state.page && state.page > 1) q.set('page', String(state.page));
  const qs = q.toString();
  return qs ? `/artists?${qs}` : '/artists';
}

export default function ArtistsIndex() {
  const { artists, nextToken, hasMore, searchQuery, browse } = useLoaderData<{
    artists: ArtistType[];
    nextToken: string | null;
    hasMore: boolean;
    searchQuery: string | null;
    browse?: BrowseState;
  }>();
  const isBrowse = Boolean(browse && (browse.sort || browse.verifiedOnly));

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

      {browse && !searchQuery && (
        <nav aria-label="Sort and filter artists" className="mb-6 flex flex-wrap gap-2">
          <FilterLink
            to={browseHref({ sort: null, verifiedOnly: browse.verifiedOnly })}
            active={!browse.sort}
          >
            All
          </FilterLink>
          <FilterLink
            to={browseHref({ sort: 'popular', verifiedOnly: browse.verifiedOnly })}
            active={browse.sort === 'popular'}
          >
            Popular
          </FilterLink>
          {/* Offered only once someone is verified: a filter that always returns nothing is
              worse than no filter. */}
          {browse.verifiedCount > 0 && (
            <FilterLink
              to={browseHref({ sort: browse.sort, verifiedOnly: !browse.verifiedOnly })}
              active={browse.verifiedOnly}
            >
              Verified · {browse.verifiedCount}
            </FilterLink>
          )}
        </nav>
      )}

      {artists.length === 0 ? (
        <EmptyState message="No artists available at the moment." />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
            {artists.map(artist => (
              <ArtistCard key={artist.id} artist={artist} />
            ))}
          </div>

          {isBrowse && browse ? (
            <nav aria-label="Pages" className="flex justify-between">
              {browse.page > 1 ? (
                <Link
                  to={browseHref({ ...browse, page: browse.page - 1 })}
                  className={cn(buttonVariants({ variant: 'outline' }), 'min-h-11 no-underline')}
                >
                  Previous
                </Link>
              ) : (
                <span />
              )}
              {hasMore && (
                <Link
                  to={browseHref({ ...browse, page: browse.page + 1 })}
                  className={cn(buttonVariants({ variant: 'outline' }), 'min-h-11 no-underline')}
                >
                  Next
                </Link>
              )}
            </nav>
          ) : (
            <EntityPagination
              currentPage={currentPage}
              hasMore={hasMore}
              nextToken={nextToken}
              baseUrl="/artists"
            />
          )}
        </>
      )}
      <BreadcrumbStructuredData
        items={[
          { name: 'Home', item: 'https://rasika.life' },
          { name: 'Artists', item: 'https://rasika.life/artists' },
        ]}
      />
    </main>
  );
}
