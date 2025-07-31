import type { LoaderFunction, MetaFunction } from '@remix-run/node';
import { json } from '@remix-run/node';
import { Link, useLoaderData } from '@remix-run/react';
import { client } from '~/api.server';
import { UnifiedSearch } from '~/components/shared/UnifiedSearch';
import { type EntityType, entityFormatters, entityUrls } from '~/lib/entityUtils';
import { globalSuite } from '~/lib/genericFactories';
import { searchConfigs } from '~/lib/searchConfig';

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

export const loader = globalSuite.loaders.search;

export const meta = globalSuite.meta.search;

const ResultCard = ({ result }: { result: SearchResult }) => {
  const getUrl = () => {
    const name = result.title || result.name || '';
    const entityType = `${result.type}s` as EntityType;
    return entityUrls.detail(entityType, name, result.id);
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
        <span>Updated {entityFormatters.formatDate(result.updatedAt)}</span>
        {result.viewCount && result.viewCount > 0 && (
          <span>{entityFormatters.formatViewCount(result.viewCount)}</span>
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
      <UnifiedSearch config={searchConfigs.globalAdvanced()} />

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
