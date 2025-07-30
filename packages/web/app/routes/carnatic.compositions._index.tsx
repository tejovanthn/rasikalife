import type { LoaderFunction, MetaFunction } from '@remix-run/node';
import { json } from '@remix-run/node';
import { Link, useLoaderData, useSearchParams, Form } from '@remix-run/react';
import { Search } from 'lucide-react';
import { type RouterOutput, client } from '~/api.server';
import { slugify } from '~/lib/carnaticUtils';

type LoaderData = {
  compositions: RouterOutput['composition']['search'];
  popularCompositions: RouterOutput['composition']['search']['items'];
  searchQuery?: string;
  ragaFilter?: string;
  talaFilter?: string;
};

export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const searchQuery = url.searchParams.get('q') || undefined;
  const ragaFilter = url.searchParams.get('raga') || undefined;
  const talaFilter = url.searchParams.get('tala') || undefined;
  const page = Number.parseInt(url.searchParams.get('page') || '1');
  const limit = 20;

  try {
    // Search compositions with filters
    const compositions = await client.composition.search.query({
      query: searchQuery,
      ragaId: ragaFilter,
      talaId: talaFilter,
      limit,
      nextToken: page > 1 ? url.searchParams.get('token') || undefined : undefined,
    });

    // Get popular compositions for homepage
    const popularCompositions =
      searchQuery || ragaFilter || talaFilter
        ? []
        : (await client.composition.search.query({ limit: 10 })).items;

    return json<LoaderData>({
      compositions,
      popularCompositions,
      searchQuery,
      ragaFilter,
      talaFilter,
    });
  } catch (error) {
    console.error('Error loading compositions:', error);
    throw new Response('Internal Server Error', { status: 500 });
  }
};

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const hasFilters = data?.searchQuery || data?.ragaFilter || data?.talaFilter;

  if (hasFilters) {
    const parts = [];
    if (data.searchQuery) parts.push(`"${data.searchQuery}"`);
    if (data.ragaFilter) parts.push(`in ${data.ragaFilter} raga`);
    if (data.talaFilter) parts.push(`in ${data.talaFilter} tala`);

    const title = `Compositions ${parts.join(' ')} - Indian Classical Music`;
    const description = `Discover Indian classical music compositions ${parts.join(' ')}. Explore lyrics, meanings, and musical details.`;

    return [
      { title },
      { name: 'description', content: description },
      {
        name: 'keywords',
        content:
          `Indian classical music, Carnatic music, compositions, ${data.searchQuery || ''}, ${data.ragaFilter || ''}, ${data.talaFilter || ''}`.trim(),
      },
    ];
  }

  return [
    { title: 'Indian Classical Music Compositions - Rasika.life' },
    {
      name: 'description',
      content:
        'Explore a comprehensive collection of Indian classical music compositions. Discover lyrics, meanings, ragas, talas, and attributions.',
    },
    {
      name: 'keywords',
      content:
        'Indian classical music, Carnatic music, Hindustani music, compositions, ragas, talas, lyrics, classical songs',
    },
    { property: 'og:title', content: 'Indian Classical Music Compositions' },
    {
      property: 'og:description',
      content:
        'Explore a comprehensive collection of Indian classical music compositions with detailed information about ragas, talas, lyrics, and meanings.',
    },
    { property: 'og:type', content: 'website' },
    {
      'script:ld+json': {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'Indian Classical Music Compositions',
        description: 'A comprehensive collection of Indian classical music compositions',
        url: 'https://rasika.life/carnatic/compositions',
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: data?.compositions.items.length || 0,
        },
      },
    },
  ];
};

const SearchAndFilters = () => {
  const [searchParams] = useSearchParams();
  const currentQuery = searchParams.get('q') || '';
  const currentRaga = searchParams.get('raga') || '';
  const currentTala = searchParams.get('tala') || '';

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <Form method="get" className="space-y-4">
        <div>
          <label htmlFor="search" className="block text-sm font-medium text-foreground mb-2">
            Search Compositions
          </label>
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground"
              size={20}
            />
            <input
              type="text"
              id="search"
              name="q"
              defaultValue={currentQuery}
              placeholder="Search by title, lyrics, or composer..."
              className="w-full pl-10 pr-4 py-3 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring bg-background"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="raga" className="block text-sm font-medium text-foreground mb-2">
              Filter by Raga
            </label>
            <input
              type="text"
              id="raga"
              name="raga"
              defaultValue={currentRaga}
              placeholder="e.g., Shankarabharanam"
              className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring bg-background"
            />
          </div>

          <div>
            <label htmlFor="tala" className="block text-sm font-medium text-foreground mb-2">
              Filter by Tala
            </label>
            <input
              type="text"
              id="tala"
              name="tala"
              defaultValue={currentTala}
              placeholder="e.g., Adi Tala"
              className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring bg-background"
            />
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
            to="/carnatic/compositions"
            className="px-6 py-3 border border-input text-muted-foreground rounded-lg hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            Clear
          </Link>
        </div>
      </Form>
    </div>
  );
};

const CompositionCard = ({
  composition,
}: { composition: LoaderData['compositions']['items'][0] }) => {
  return (
    <Link
      to={slugify({ name: composition.title, id: composition.id, type: 'compositions' })}
      className="block p-4 border border-border rounded-lg hover:shadow-md transition-shadow bg-card"
    >
      <h3 className="font-semibold text-lg text-foreground mb-2">{composition.title}</h3>

      {composition.alternativeTitles && composition.alternativeTitles.length > 0 && (
        <p className="text-sm text-muted-foreground mb-2">
          Also: {composition.alternativeTitles.join(', ')}
        </p>
      )}

      <div className="text-sm text-muted-foreground space-y-1">
        {composition.ragaIds && (
          <div>
            <span className="font-medium text-foreground">Raga:</span> {composition.ragaIds}
          </div>
        )}
        {composition.talaIds && (
          <div>
            <span className="font-medium text-foreground">Tala:</span> {composition.talaIds}
          </div>
        )}
        {composition.language && (
          <div>
            <span className="font-medium text-foreground">Language:</span> {composition.language}
          </div>
        )}
      </div>

      {composition.meaning && (
        <p className="text-sm text-muted-foreground mt-3 line-clamp-2">
          {composition.meaning.length > 150
            ? composition.meaning.substring(0, 150) + '...'
            : composition.meaning}
        </p>
      )}

      <div className="flex justify-between items-center mt-3 text-xs text-muted-foreground">
        <span>Updated {new Date(composition.updatedAt).toLocaleDateString()}</span>
        {composition.viewCount && <span>{composition.viewCount} views</span>}
      </div>
    </Link>
  );
};

const Pagination = ({
  hasMore,
  nextToken,
  searchParams,
}: {
  hasMore: boolean;
  nextToken?: string;
  searchParams: URLSearchParams;
}) => {
  if (!hasMore) return null;

  const nextPageParams = new URLSearchParams(searchParams);
  if (nextToken) {
    nextPageParams.set('token', nextToken);
    const currentPage = Number.parseInt(searchParams.get('page') || '1');
    nextPageParams.set('page', (currentPage + 1).toString());
  }

  return (
    <div className="flex justify-center mt-8">
      <Link
        to={`?${nextPageParams.toString()}`}
        className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        Load More
      </Link>
    </div>
  );
};

export default function CompositionsIndex() {
  const { compositions, popularCompositions, searchQuery, ragaFilter, talaFilter } =
    useLoaderData<LoaderData>();
  const [searchParams] = useSearchParams();

  const hasFilters = searchQuery || ragaFilter || talaFilter;
  const showPopular = !hasFilters && popularCompositions.length > 0;

  return (
    <main className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <header className="mb-8">
        <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl mb-4 text-foreground">
          {hasFilters ? 'Search Results' : 'Compositions'}
        </h1>
        <p className="text-xl text-muted-foreground">
          {hasFilters
            ? `Found ${compositions.items.length} compositions`
            : 'Explore our collection of Indian classical music compositions'}
        </p>
      </header>

      {/* Search and Filters */}
      <div className="mb-8">
        <SearchAndFilters />
      </div>

      {/* Popular Compositions */}
      {showPopular && (
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-foreground mb-6">Popular Compositions</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {popularCompositions.map(composition => (
              <CompositionCard key={composition.id} composition={composition} />
            ))}
          </div>
        </section>
      )}

      {/* All Compositions */}
      <section>
        {hasFilters && (
          <h2 className="text-2xl font-bold text-foreground mb-6">
            {compositions.items.length === 0 ? 'No Results Found' : 'Search Results'}
          </h2>
        )}

        {compositions.items.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-lg">
              {hasFilters
                ? 'No compositions found matching your criteria. Try adjusting your search terms.'
                : 'No compositions available at the moment.'}
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {compositions.items.map(composition => (
                <CompositionCard key={composition.id} composition={composition} />
              ))}
            </div>

            <Pagination
              hasMore={compositions.hasMore}
              nextToken={compositions.nextToken}
              searchParams={searchParams}
            />
          </>
        )}
      </section>
    </main>
  );
}
