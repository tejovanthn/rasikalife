/**
 * Generic factory functions that create commonly used patterns
 * These factories reduce boilerplate by generating functions, components, and configs
 */

import type { LoaderFunction, MetaFunction } from '@remix-run/node';
import { json } from '@remix-run/node';
import { client } from '~/api.server';
import { detailConfigs } from './detailRouteConfig';
import { type EntityItem, type EntityType, entityApi, entitySeo, entityUrls } from './entityUtils';
import { entityConfigs } from './routeConfig';

// =============================================================================
// LOADER FACTORIES
// =============================================================================

/**
 * Create a generic search loader for any entity type
 */
export function createSearchLoader(entityType: EntityType): LoaderFunction {
  return async ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('q') || undefined;

    // Extract all possible filter values
    const filters: Record<string, any> = {};
    const config = entityConfigs[entityType];

    config?.filters?.forEach(filter => {
      const value = url.searchParams.get(filter.name);
      if (value) {
        filters[filter.name] = filter.type === 'number' ? Number.parseInt(value) : value;
      }
    });

    try {
      const searchParams = entityApi.buildSearchParams(entityType, query, filters);
      const endpoint = entityApi.getEndpoint(entityType);

      // Call appropriate API endpoint
      const results = await (client as any)[endpoint].search.query(searchParams);

      // Get popular items if no search/filters
      let popularItems = [];
      if (!query && Object.keys(filters).length === 0 && config?.hasPopularSection) {
        if (endpoint === 'artist') {
          popularItems = await (client as any)[endpoint].getPopular.query({
            limit: config.popularLimit,
          });
        } else {
          const popular = await (client as any)[endpoint].search.query({
            limit: config.popularLimit,
          });
          popularItems = popular.items;
        }
      }

      return json({
        results,
        popularItems,
        searchQuery: query,
        filters,
        entityType,
      });
    } catch (error) {
      throw entityApi.handleError(error, `search ${entityType}`);
    }
  };
}

/**
 * Create a generic detail loader for any entity type
 */
export function createDetailLoader(entityType: EntityType): LoaderFunction {
  return async ({ params, request }) => {
    const config = detailConfigs[entityType];
    const paramValue = params[config.paramName];

    if (!paramValue) {
      throw new Response('Not Found', {
        status: 404,
        statusText: `${config.singular} ID is required`,
      });
    }

    const entityId = entityUrls.extractId(paramValue);
    if (!entityId) {
      throw new Response(`Invalid ${config.singular.toLowerCase()} ID format`, {
        status: 400,
        statusText: 'Invalid URL format',
      });
    }

    try {
      const endpoint = entityApi.getEndpoint(entityType);

      // Get entity details
      const entity = await (client as any)[endpoint].getById({
        id: entityId,
        trackView: true,
      });

      if (!entity) {
        throw new Response(`${config.singular} not found`, {
          status: 404,
          statusText: `The requested ${config.singular.toLowerCase()} could not be found`,
        });
      }

      // Get related items if configured
      let relatedItems: any[] = [];
      if (config.relatedItemsConfig) {
        relatedItems = await config.relatedItemsConfig.getRelatedItems(entity);
      }

      // Build breadcrumbs
      const breadcrumbs = config.getBreadcrumbs(entity, paramValue);

      return json({
        entity,
        relatedItems,
        breadcrumbs,
        entityType,
      });
    } catch (error) {
      throw entityApi.handleError(error, `load ${config.singular.toLowerCase()}`);
    }
  };
}

/**
 * Create a generic global search loader that searches across all entity types
 */
export function createGlobalSearchLoader(): LoaderFunction {
  return async ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('q') || '';
    const type = url.searchParams.get('type') || 'all';

    // Extract filters
    const filters: Record<string, string> = {};
    ['tradition', 'language', 'melakarta', 'aksharas', 'artistType'].forEach(key => {
      const value = url.searchParams.get(key);
      if (value) filters[key] = value;
    });

    // Remove empty filters
    Object.keys(filters).forEach(key => {
      if (!filters[key]) delete filters[key];
    });

    try {
      const results: any[] = [];
      let totalResults = 0;

      if (query.length >= 2 || Object.keys(filters).length > 0) {
        // Search each entity type
        const entityTypes: EntityType[] = ['compositions', 'artists', 'ragas', 'talas'];

        for (const entityType of entityTypes) {
          if (type === 'all' || type === entityType) {
            const searchParams = entityApi.buildSearchParams(
              entityType,
              query || undefined,
              filters,
              { limit: type === entityType ? 50 : 15 }
            );

            const endpoint = entityApi.getEndpoint(entityType);
            const entityResults = await (client as any)[endpoint].search.query(searchParams);

            results.push(
              ...entityResults.items.map((item: any) => ({
                ...item,
                type: entityType.slice(0, -1), // Remove 's' for singular
                url: entityUrls.detail(entityType, item.title || item.name, item.id),
              }))
            );

            totalResults += entityResults.items.length;
          }
        }
      }

      return json({
        results,
        query,
        type,
        totalResults,
        appliedFilters: filters,
      });
    } catch (error) {
      throw entityApi.handleError(error, 'global search');
    }
  };
}

// =============================================================================
// META FACTORIES
// =============================================================================

/**
 * Create a generic meta function for search pages
 */
export function createSearchMeta(entityType: EntityType): MetaFunction {
  return ({ data }) => {
    const hasFilters = data?.searchQuery || (data?.filters && Object.keys(data.filters).length > 0);

    if (hasFilters) {
      const searchTerms = [];
      if (data.searchQuery) searchTerms.push(data.searchQuery);

      // Add filter descriptions
      Object.entries(data.filters || {}).forEach(([key, value]) => {
        if (value) searchTerms.push(`${key}: ${value}`);
      });

      return [
        { title: entitySeo.generateTitle(entityType, undefined, 'search', searchTerms) },
        {
          name: 'description',
          content: entitySeo.generateDescription(entityType, undefined, 'search', searchTerms),
        },
        {
          name: 'keywords',
          content: entitySeo.generateKeywords(entityType, undefined, searchTerms),
        },
      ];
    }

    return [
      { title: entitySeo.generateTitle(entityType) },
      { name: 'description', content: entitySeo.generateDescription(entityType) },
      { name: 'keywords', content: entitySeo.generateKeywords(entityType) },
    ];
  };
}

/**
 * Create a generic meta function for detail pages
 */
export function createDetailMeta(entityType: EntityType): MetaFunction {
  return ({ data, params, location }) => {
    const canonicalUrl = entityUrls.canonical(location.pathname);

    if (!data?.entity) {
      const config = detailConfigs[entityType];
      return [
        { title: `${config.singular} Not Found - Rasika.life` },
        {
          name: 'description',
          content: `The requested ${config.singular.toLowerCase()} could not be found.`,
        },
        { name: 'robots', content: 'noindex' },
        { rel: 'canonical', href: canonicalUrl },
      ];
    }

    const { entity, breadcrumbs } = data;
    const title = entitySeo.generateTitle(entityType, entity.title || entity.name, 'detail');
    const description = entitySeo.generateDescription(entityType, entity, 'detail');
    const keywords = entitySeo.generateKeywords(entityType, entity);

    const metaTags: any[] = [
      { title },
      { name: 'description', content: description },
      { name: 'keywords', content: keywords },
      { rel: 'canonical', href: canonicalUrl },

      // OpenGraph
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:type', content: entityType === 'artists' ? 'profile' : 'article' },
      { property: 'og:url', content: canonicalUrl },
      { property: 'og:site_name', content: 'Rasika.life' },

      // Twitter Card
      { name: 'twitter:card', content: 'summary' },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
    ];

    // Add image if available
    const config = detailConfigs[entityType];
    if (config.hasImage && config.imageField && entity[config.imageField]) {
      metaTags.push({ property: 'og:image', content: entity[config.imageField] });
    }

    // Add structured data
    metaTags.push({
      'script:ld+json': entitySeo.generateStructuredData(entityType, entity, breadcrumbs),
    });

    return metaTags;
  };
}

/**
 * Create a generic meta function for global search
 */
export function createGlobalSearchMeta(): MetaFunction {
  return ({ data }) => {
    const hasQuery = data?.query && data.query.length > 0;
    const hasFilters = data?.appliedFilters && Object.keys(data.appliedFilters).length > 0;

    if (hasQuery || hasFilters) {
      const searchTerms = [];
      if (hasQuery) searchTerms.push(data.query);

      Object.entries(data.appliedFilters || {}).forEach(([key, value]) => {
        if (value) searchTerms.push(value);
      });

      const title = `Search Results: ${searchTerms.join(', ')} - Indian Classical Music`;
      const description = `Find Indian classical music content matching "${searchTerms.join(', ')}". Discover compositions, artists, ragas, and talas.`;

      return [
        { title },
        { name: 'description', content: description },
        { name: 'keywords', content: `search, ${searchTerms.join(', ')}, Indian classical music` },
      ];
    }

    return [
      { title: 'Search - Indian Classical Music Database' },
      {
        name: 'description',
        content:
          'Search across our comprehensive database of Indian classical music compositions, artists, ragas, and talas.',
      },
      {
        name: 'keywords',
        content: 'search, Indian classical music, compositions, artists, ragas, talas',
      },
    ];
  };
}

// =============================================================================
// COMPONENT FACTORIES
// =============================================================================

/**
 * Create a generic card renderer for any entity type
 */
export function createEntityCardRenderer(entityType: EntityType) {
  return (entity: EntityItem) => {
    const config = entityConfigs[entityType];
    if (!config) return null;

    const fields = config.getCardFields(entity);
    const subtitle = config.getCardSubtitle?.(entity);
    const description = config.getCardDescription?.(entity);
    const image = config.getCardImage?.(entity);
    const metadata = config.getCardMetadata?.(entity);

    return {
      id: entity.id,
      title: entity.title || entity.name || 'Unknown',
      type: entityType,
      subtitle,
      fields,
      description,
      image,
      imageAlt: entity.title || entity.name,
      metadata,
    };
  };
}

/**
 * Create a generic error boundary component props
 */
export function createErrorBoundaryProps(entityType: EntityType) {
  const config = entityConfigs[entityType];
  return {
    entityType: config?.singular.toLowerCase() || entityType.slice(0, -1),
    entityPlural: config?.plural || entityType,
    basePath: config?.basePath || `/carnatic/${entityType}`,
  };
}

// =============================================================================
// VALIDATION FACTORIES
// =============================================================================

/**
 * Create parameter validation for entity routes
 */
export function createParamValidator(entityType: EntityType) {
  const config = detailConfigs[entityType];

  return (params: Record<string, string | undefined>) => {
    const paramValue = params[config.paramName];

    if (!paramValue) {
      throw new Response('Not Found', {
        status: 404,
        statusText: `${config.singular} ID is required`,
      });
    }

    const entityId = entityUrls.extractId(paramValue);
    if (!entityId) {
      throw new Response(`Invalid ${config.singular.toLowerCase()} ID format`, {
        status: 400,
        statusText: 'Invalid URL format',
      });
    }

    return { paramValue, entityId };
  };
}

// =============================================================================
// BULK OPERATIONS
// =============================================================================

/**
 * Create all common functions for an entity type at once
 */
export function createEntitySuite(entityType: EntityType) {
  return {
    // Loaders
    loaders: {
      search: createSearchLoader(entityType),
      detail: createDetailLoader(entityType),
    },

    // Meta functions
    meta: {
      search: createSearchMeta(entityType),
      detail: createDetailMeta(entityType),
    },

    // Component helpers
    components: {
      cardRenderer: createEntityCardRenderer(entityType),
      errorBoundaryProps: createErrorBoundaryProps(entityType),
    },

    // Validators
    validators: {
      params: createParamValidator(entityType),
    },
  };
}

// Pre-created suites for each entity type
export const artistSuite = createEntitySuite('artists');
export const compositionSuite = createEntitySuite('compositions');
export const ragaSuite = createEntitySuite('ragas');
export const talaSuite = createEntitySuite('talas');

// Global suite
export const globalSuite = {
  loaders: {
    search: createGlobalSearchLoader(),
  },
  meta: {
    search: createGlobalSearchMeta(),
  },
};
