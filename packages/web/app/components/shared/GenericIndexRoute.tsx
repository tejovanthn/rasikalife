import { useLoaderData, useSearchParams } from '@remix-run/react';
import type { EntityConfig } from '~/lib/routeConfig';
import { EmptyState, EntityCard, Pagination, SearchForm, SectionHeader } from './index';

interface GenericIndexRouteProps<T = Record<string, unknown>> {
  config: EntityConfig;
}

interface GenericIndexLoaderData<T = Record<string, unknown>> {
  results: { items: T[]; hasMore: boolean; nextToken?: string };
  popularItems: T[];
  searchQuery?: string;
  filters: Record<string, unknown>;
}

export function GenericIndexRoute<T = Record<string, unknown>>({
  config,
}: GenericIndexRouteProps<T>) {
  const { results, popularItems, searchQuery, filters } =
    useLoaderData<GenericIndexLoaderData<T>>();
  const [searchParams] = useSearchParams();

  const hasFilters = searchQuery || Object.keys(filters).length > 0;
  const showPopular = !hasFilters && popularItems.length > 0;

  // Configure search filters with current values
  const searchFilters = config.filters.map(filter => {
    // Map API parameter names back to filter names
    let filterValue = filters[filter.name];
    if (filter.name === 'raga' && filters.ragaId) {
      filterValue = filters.ragaId;
    } else if (filter.name === 'tala' && filters.talaId) {
      filterValue = filters.talaId;
    }

    return {
      ...filter,
      defaultValue: filterValue || filter.defaultValue,
    };
  });

  const renderCard = (item: T) => (
    <EntityCard
      key={item.id}
      id={item.id}
      title={item.name || item.title}
      type={config.type}
      subtitle={config.getCardSubtitle?.(item)}
      fields={config.getCardFields(item)}
      description={config.getCardDescription?.(item)}
      image={config.getCardImage?.(item)}
      imageAlt={item.name || item.title}
      metadata={config.getCardMetadata?.(item)}
      {...(config.type === 'artists' && item.profileImage ? {} : {})}
    />
  );

  return (
    <main className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <header className="mb-8">
        <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl mb-4 text-foreground">
          {hasFilters ? 'Search Results' : config.plural}
        </h1>
        <p className="text-xl text-muted-foreground">
          {hasFilters
            ? `Found ${results.items.length} ${config.plural.toLowerCase()}`
            : config.description}
        </p>
      </header>

      {/* Search and Filters */}
      <div className="mb-8">
        <SearchForm
          searchQuery={searchQuery}
          filters={searchFilters}
          clearPath={config.basePath}
          searchPlaceholder={config.searchPlaceholder}
          searchLabel={config.searchLabel}
        />
      </div>

      {/* Popular Section */}
      {showPopular && (
        <section className="mb-12">
          <SectionHeader title={`Popular ${config.plural}`} />
          <div className={`grid gap-4 ${config.gridCols}`}>{popularItems.map(renderCard)}</div>
        </section>
      )}

      {/* Results Section */}
      <section>
        {hasFilters && (
          <h2 className="text-2xl font-bold text-foreground mb-6">
            {results.items.length === 0 ? 'No Results Found' : 'Search Results'}
          </h2>
        )}

        {results.items.length === 0 ? (
          <EmptyState
            message={
              hasFilters
                ? `No ${config.plural.toLowerCase()} found matching your criteria.`
                : `No ${config.plural.toLowerCase()} available at the moment.`
            }
            description={hasFilters ? 'Try adjusting your search terms.' : undefined}
          />
        ) : (
          <>
            <div className={`grid gap-4 ${config.gridCols}`}>{results.items.map(renderCard)}</div>

            <Pagination
              hasMore={results.hasMore}
              nextToken={results.nextToken}
              searchParams={searchParams}
            />
          </>
        )}
      </section>
    </main>
  );
}
