import type { LoaderFunction, MetaFunction } from '@remix-run/node';
import { json } from '@remix-run/node';
import { Link, useLoaderData, useSearchParams, Form } from '@remix-run/react';
import { Search } from 'lucide-react';
import { type RouterOutput, client } from '~/api.server';
import { slugify } from '~/lib/carnaticUtils';

type LoaderData = {
  artists: RouterOutput['artist']['search'];
  popularArtists: RouterOutput['artist']['getPopular'];
  searchQuery?: string;
  traditionFilter?: string;
};

export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const searchQuery = url.searchParams.get('q') || undefined;
  const traditionFilter = url.searchParams.get('tradition') || undefined;
  const page = Number.parseInt(url.searchParams.get('page') || '1');
  const limit = 20;

  try {
    // Search artists with filters
    const artists = await client.artist.search.query({
      query: searchQuery,
      tradition: traditionFilter as any,
      limit,
      nextToken: page > 1 ? url.searchParams.get('token') || undefined : undefined,
    });

    // Get popular artists for homepage
    const popularArtists =
      searchQuery || traditionFilter ? [] : await client.artist.getPopular.query({ limit: 12 });

    return json<LoaderData>({
      artists,
      popularArtists: popularArtists as RouterOutput['artist']['getPopular'],
      searchQuery,
      traditionFilter,
    });
  } catch (error) {
    console.error('Error loading artists:', error);
    throw new Response('Internal Server Error', { status: 500 });
  }
};

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const hasFilters = data?.searchQuery || data?.traditionFilter;

  if (hasFilters) {
    const parts = [];
    if (data.searchQuery) parts.push(`"${data.searchQuery}"`);
    if (data.traditionFilter) parts.push(`${data.traditionFilter} artists`);

    const title = `Artists ${parts.join(' ')} - Indian Classical Music`;
    const description = `Discover Indian classical music artists ${parts.join(' ')}. Learn about their contributions and musical journey.`;

    return [{ title }, { name: 'description', content: description }];
  }

  return [
    { title: 'Indian Classical Music Artists - Rasika.life' },
    {
      name: 'description',
      content:
        'Explore renowned artists of Indian classical music. Discover their biographies, musical styles, and contributions to classical traditions.',
    },
    {
      name: 'keywords',
      content:
        'Indian classical music artists, Carnatic musicians, Hindustani artists, classical musicians, maestros',
    },
  ];
};

const ArtistCard = ({ artist }: { artist: LoaderData['artists']['items'][0] }) => {
  return (
    <Link
      to={slugify({ name: artist.name, id: artist.id, type: 'artists' })}
      className="block p-4 border border-border rounded-lg hover:shadow-md transition-shadow bg-card"
    >
      <div className="flex items-start space-x-4">
        {artist.profileImage && (
          <img
            src={artist.profileImage}
            alt={artist.name}
            className="w-16 h-16 rounded-full object-cover"
          />
        )}
        <div className="flex-1">
          <h3 className="font-semibold text-lg text-foreground mb-1">{artist.name}</h3>
          <p className="text-sm text-primary mb-2">{artist.artistType}</p>

          {artist.instruments && artist.instruments.length > 0 && (
            <p className="text-sm text-muted-foreground mb-2">
              <span className="font-medium text-foreground">Instruments:</span> {artist.instruments.join(', ')}
            </p>
          )}

          {artist.traditions && artist.traditions.length > 0 && (
            <p className="text-sm text-muted-foreground mb-2">
              <span className="font-medium text-foreground">Traditions:</span> {artist.traditions.join(', ')}
            </p>
          )}

          {artist.bio && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {artist.bio.length > 150 ? artist.bio.substring(0, 150) + '...' : artist.bio}
            </p>
          )}

          <div className="flex justify-between items-center mt-3 text-xs text-muted-foreground">
            <span>Updated {new Date(artist.updatedAt).toLocaleDateString()}</span>
            {artist.viewCount && <span>{artist.viewCount} views</span>}
          </div>
        </div>
      </div>
    </Link>
  );
};

export default function ArtistsIndex() {
  const { artists, popularArtists, searchQuery, traditionFilter } = useLoaderData<LoaderData>();
  const [searchParams] = useSearchParams();

  const hasFilters = searchQuery || traditionFilter;
  const showPopular = !hasFilters && popularArtists.length > 0;

  return (
    <main className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <header className="mb-8">
        <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl mb-4 text-foreground">
          {hasFilters ? 'Search Results' : 'Artists'}
        </h1>
        <p className="text-xl text-muted-foreground">
          {hasFilters
            ? `Found ${artists.items.length} artists`
            : 'Discover the masters of Indian classical music'}
        </p>
      </header>

      {/* Search and Filters */}
      <div className="bg-card border border-border rounded-lg p-6 mb-8">
        <Form method="get" className="space-y-4">
          <div>
            <label htmlFor="search" className="block text-sm font-medium text-foreground mb-2">
              Search Artists
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={20} />
              <input
                type="text"
                id="search"
                name="q"
                defaultValue={searchQuery || ''}
                placeholder="Search by name, instrument, or tradition..."
                className="w-full pl-10 pr-4 py-3 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring bg-background"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="tradition" className="block text-sm font-medium text-foreground mb-2">
                Filter by Tradition
              </label>
              <select
                id="tradition"
                name="tradition"
                defaultValue={traditionFilter || ''}
                className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring bg-background"
              >
                <option value="">All Traditions</option>
                <option value="carnatic">Carnatic</option>
                <option value="hindustani">Hindustani</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              Search
            </button>
            <Link
              to="/carnatic/artists"
              className="px-6 py-3 border border-input text-muted-foreground rounded-lg hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              Clear
            </Link>
          </div>
        </Form>
      </div>

      {/* Popular Artists */}
      {showPopular && (
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-foreground mb-6">Popular Artists</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {popularArtists.map(artist => (
              <ArtistCard key={artist.id} artist={artist} />
            ))}
          </div>
        </section>
      )}

      {/* All Artists */}
      <section>
        {hasFilters && (
          <h2 className="text-2xl font-bold text-foreground mb-6">
            {artists.items.length === 0 ? 'No Results Found' : 'Search Results'}
          </h2>
        )}

        {artists.items.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-lg">
              {hasFilters
                ? 'No artists found matching your criteria. Try adjusting your search terms.'
                : 'No artists available at the moment.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
            {artists.items.map(artist => (
              <ArtistCard key={artist.id} artist={artist} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
