import type { LoaderFunction, MetaFunction } from '@remix-run/node';
import { json } from '@remix-run/node';
import { useLoaderData, Link } from '@remix-run/react';
import { client } from '~/api.server';
import { slugify } from '~/lib/carnaticUtils';
import { AdvancedSearch } from '~/components/AdvancedSearch';

interface SearchResult {
  id: string;
  name?: string;
  title?: string;
  type: 'composition' | 'artist' | 'raga' | 'tala';
  // Additional fields for display
  ragaName?: string;
  talaName?: string;
  artistType?: string;
  melakarta?: number;
  aksharas?: number;
  tradition?: string;
  language?: string;
  viewCount?: number;
  updatedAt: string;
}

interface LoaderData {
  results: SearchResult[];
  query: string;
  type: string;
  totalResults: number;
  appliedFilters: Record<string, string>;
}

export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const query = url.searchParams.get('q') || '';
  const type = url.searchParams.get('type') || 'all';
  const tradition = url.searchParams.get('tradition') || '';
  const language = url.searchParams.get('language') || '';
  const melakarta = url.searchParams.get('melakarta') || '';
  const aksharas = url.searchParams.get('aksharas') || '';
  const artistType = url.searchParams.get('artistType') || '';

  const appliedFilters = {
    tradition,
    language,
    melakarta,
    aksharas,
    artistType,
  };

  // Remove empty filters
  Object.keys(appliedFilters).forEach(key => {
    if (!appliedFilters[key]) {
      delete appliedFilters[key];
    }
  });

  try {
    const results: SearchResult[] = [];
    let totalResults = 0;

    if (query.length >= 2 || Object.keys(appliedFilters).length > 0) {
      // Search based on type with filters
      if (type === 'all' || type === 'compositions') {
        const compositions = await client.composition.search.query({
          query: query || undefined,
          language: language || undefined,
          limit: type === 'compositions' ? 50 : 15,
        });

        results.push(
          ...compositions.items.map((item: any) => ({
            id: item.id,
            title: item.title,
            type: 'composition' as const,
            ragaName: item.ragaName,
            talaName: item.talaName,
            language: item.language,
            tradition: item.tradition,
            viewCount: item.viewCount,
            updatedAt: item.updatedAt,
          }))
        );
      }

      if (type === 'all' || type === 'artists') {
        const artists = await client.artist.search.query({
          query: query || undefined,
          artistType: artistType || undefined,
          tradition: tradition || undefined,
          limit: type === 'artists' ? 50 : 15,
        });

        results.push(
          ...artists.items.map((item: any) => ({
            id: item.id,
            name: item.name,
            type: 'artist' as const,
            artistType: item.artistType,
            tradition: item.tradition,
            viewCount: item.viewCount,
            updatedAt: item.updatedAt,
          }))
        );
      }

      if (type === 'all' || type === 'ragas') {
        const searchParams: any = {
          query: query || undefined,
          limit: type === 'ragas' ? 50 : 15,
        };

        if (melakarta) {
          searchParams.melakarta = Number.parseInt(melakarta);
        }
        if (tradition) {
          searchParams.tradition = tradition;
        }

        const ragas = await client.raga.search.query(searchParams);

        results.push(
          ...ragas.items.map((item: any) => ({
            id: item.id,
            name: item.name,
            type: 'raga' as const,
            melakarta: item.melakarta,
            tradition: item.tradition,
            viewCount: item.viewCount,
            updatedAt: item.updatedAt,
          }))
        );
      }

      if (type === 'all' || type === 'talas') {
        const searchParams: any = {
          query: query || undefined,
          limit: type === 'talas' ? 50 : 15,
        };

        if (aksharas) {
          searchParams.aksharas = Number.parseInt(aksharas);
        }
        if (tradition) {
          searchParams.tradition = tradition;
        }

        const talas = await client.tala.search.query(searchParams);

        results.push(
          ...talas.items.map((item: any) => ({
            id: item.id,
            name: item.name,
            type: 'tala' as const,
            aksharas: item.aksharas,
            tradition: item.tradition,
            viewCount: item.viewCount,
            updatedAt: item.updatedAt,
          }))
        );
      }

      totalResults = results.length;
    }

    return json<LoaderData>({
      results,
      query,
      type,
      totalResults,
      appliedFilters,
    });
  } catch (error) {
    console.error('Search error:', error);
    return json<LoaderData>({
      results: [],
      query,
      type,
      totalResults: 0,
      appliedFilters,
    });
  }
};

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const title = data?.query
    ? `Search: "${data.query}" - Rasika.life`
    : 'Advanced Search - Rasika.life';

  const description = data?.query
    ? `Search results for "${data.query}" - ${data.totalResults} results found`
    : 'Search Indian classical music compositions, artists, ragas, and talas';

  return [
    { title },
    { name: 'description', content: description },
    {
      name: 'keywords',
      content:
        'search, Indian classical music, Carnatic music, compositions, artists, ragas, talas',
    },
  ];
};

const ResultCard = ({ result }: { result: SearchResult }) => {
  const getUrl = () => {
    const name = result.title || result.name || '';
    return slugify({ name, id: result.id, type: `${result.type}s` });
  };

  const getTypeColor = () => {
    switch (result.type) {
      case 'composition':
        return 'bg-primary/10 text-primary';
      case 'artist':
        return 'bg-green-500/10 text-green-700 dark:text-green-400';
      case 'raga':
        return 'bg-purple-500/10 text-purple-700 dark:text-purple-400';
      case 'tala':
        return 'bg-orange-500/10 text-orange-700 dark:text-orange-400';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Link
      to={getUrl()}
      className="block p-6 border border-border rounded-lg hover:shadow-md transition-shadow bg-card"
    >
      <div className="flex justify-between items-start mb-3">
        <h3 className="text-lg font-semibold text-foreground line-clamp-2">
          {result.title || result.name}
        </h3>
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getTypeColor()}`}>
          {result.type}
        </span>
      </div>

      <div className="space-y-1 text-sm text-muted-foreground">
        {result.ragaName && (
          <div>
            Raga: <span className="font-medium">{result.ragaName}</span>
          </div>
        )}
        {result.talaName && (
          <div>
            Tala: <span className="font-medium">{result.talaName}</span>
          </div>
        )}
        {result.artistType && (
          <div>
            Type: <span className="font-medium">{result.artistType}</span>
          </div>
        )}
        {result.melakarta && (
          <div>
            Melakarta: <span className="font-medium">{result.melakarta}</span>
          </div>
        )}
        {result.aksharas && (
          <div>
            Aksharas: <span className="font-medium">{result.aksharas}</span>
          </div>
        )}
        {result.tradition && (
          <div>
            Tradition: <span className="font-medium">{result.tradition}</span>
          </div>
        )}
        {result.language && (
          <div>
            Language: <span className="font-medium">{result.language}</span>
          </div>
        )}
      </div>

      <div className="flex justify-between items-center mt-4 text-xs text-muted-foreground">
        <span>Updated {new Date(result.updatedAt).toLocaleDateString()}</span>
        {result.viewCount && result.viewCount > 0 && (
          <span>{result.viewCount.toLocaleString()} views</span>
        )}
      </div>
    </Link>
  );
};

export default function SearchResults() {
  const { results, query, type, totalResults, appliedFilters } = useLoaderData<LoaderData>();

  const hasQuery = query.length >= 2;
  const hasFilters = Object.keys(appliedFilters).length > 0;
  const hasSearched = hasQuery || hasFilters;

  return (
    <main className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <header className="mb-8">
        <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl mb-4">
          {hasQuery ? `Search: "${query}"` : 'Advanced Search'}
        </h1>
        {hasSearched && (
          <p className="text-xl text-muted-foreground">
            Found {totalResults} result{totalResults !== 1 ? 's' : ''}
            {type !== 'all' && ` in ${type}`}
          </p>
        )}
      </header>

      {/* Search Interface */}
      <AdvancedSearch />

      {/* Active Filters */}
      {hasFilters && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-foreground mb-2">Active Filters:</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(appliedFilters).map(([key, value]) => (
              <span
                key={key}
                className="inline-flex items-center px-3 py-1 text-sm bg-primary/10 text-primary rounded-full"
              >
                {key}: {value}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {hasSearched && (
        <section>
          {results.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-lg mb-4">
                No results found matching your criteria.
              </p>
              <p className="text-muted-foreground/60">
                Try adjusting your search terms or filters.
              </p>
            </div>
          ) : (
            <>
              {/* Results by Type */}
              {type === 'all' && (
                <div className="space-y-8">
                  {['composition', 'artist', 'raga', 'tala'].map(resultType => {
                    const typeResults = results.filter(r => r.type === resultType);
                    if (typeResults.length === 0) return null;

                    return (
                      <div key={resultType}>
                        <h2 className="text-2xl font-bold text-foreground mb-4 capitalize">
                          {resultType}s ({typeResults.length})
                        </h2>
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                          {typeResults.map(result => (
                            <ResultCard key={`${result.type}-${result.id}`} result={result} />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* All Results */}
              {type !== 'all' && (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {results.map(result => (
                    <ResultCard key={`${result.type}-${result.id}`} result={result} />
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      )}
    </main>
  );
}
