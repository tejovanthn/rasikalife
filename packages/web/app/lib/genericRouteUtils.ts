import type { LoaderFunction, MetaFunction } from '@remix-run/node';
import { json } from '@remix-run/node';
import { client } from '~/api.server';
import type { EntityConfig } from './routeConfig';

// Generic loader factory
export function createEntityLoader(config: EntityConfig): LoaderFunction {
  return async ({ request }) => {
    const url = new URL(request.url);
    const searchQuery = url.searchParams.get('q') || undefined;
    const page = Number.parseInt(url.searchParams.get('page') || '1');

    // Extract filter values based on config
    const filterValues: Record<string, any> = {};
    for (const filter of config.filters) {
      const value = url.searchParams.get(filter.name);
      if (value) {
        const processedValue = filter.type === 'number' ? Number.parseInt(value) : value;

        // Map filter names to API parameter names
        if (filter.name === 'raga' && config.apiEndpoint === 'composition') {
          filterValues.ragaId = processedValue;
        } else if (filter.name === 'tala' && config.apiEndpoint === 'composition') {
          filterValues.talaId = processedValue;
        } else {
          filterValues[filter.name] = processedValue;
        }
      }
    }

    try {
      // Build search parameters
      const searchParams: any = {
        query: searchQuery,
        limit: config.defaultLimit,
        nextToken: page > 1 ? url.searchParams.get('token') || undefined : undefined,
        ...filterValues,
      };

      // Get search results
      const searchResults = await (client as any)[config.apiEndpoint].search.query(searchParams);

      // Get popular items if needed
      let popularItems: any[] = [];
      if (config.hasPopularSection && !searchQuery && Object.keys(filterValues).length === 0) {
        if (config.apiEndpoint === 'artist') {
          popularItems = await (client as any)[config.apiEndpoint].getPopular.query({
            limit: config.popularLimit,
          });
        } else if (config.apiEndpoint === 'composition') {
          const popular = await (client as any)[config.apiEndpoint].search.query({
            limit: config.popularLimit,
          });
          popularItems = popular.items;
        }
      }

      return json({
        results: searchResults,
        popularItems,
        searchQuery,
        filters: filterValues,
      });
    } catch (error) {
      console.error(`Error loading ${config.plural.toLowerCase()}:`, error);
      throw new Response('Internal Server Error', { status: 500 });
    }
  };
}

// Generic meta function factory
export function createEntityMeta(config: EntityConfig): MetaFunction {
  return ({ data }) => {
    const hasFilters = data?.searchQuery || (data?.filters && Object.keys(data.filters).length > 0);

    if (hasFilters) {
      const parts = [];
      if (data.searchQuery) parts.push(`"${data.searchQuery}"`);

      // Add filter descriptions
      for (const [key, value] of Object.entries(data.filters || {})) {
        if (value) {
          // Map API parameter names back to filter names for display
          let filterName = key;
          if (key === 'ragaId') filterName = 'raga';
          if (key === 'talaId') filterName = 'tala';

          const filter = config.filters.find(f => f.name === filterName);
          if (filter) {
            parts.push(`${filter.label.toLowerCase().replace('filter by ', '')} ${value}`);
          }
        }
      }

      const title = `${config.plural} ${parts.join(' ')} - Indian Classical Music`;
      const description = `Discover Indian classical music ${config.plural.toLowerCase()} ${parts.join(' ')}. ${config.description}`;

      return [
        { title },
        { name: 'description', content: description },
        { name: 'keywords', content: `${config.keywords}, ${data.searchQuery || ''}`.trim() },
      ];
    }

    return [
      { title: config.title },
      { name: 'description', content: config.description },
      { name: 'keywords', content: config.keywords },
    ];
  };
}
