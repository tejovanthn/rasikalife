/**
 * Entity-aware utilities that work with our entity config system
 * These utilities provide DRY, type-safe operations across all entity types
 */

import { convert } from 'url-slug';
import { detailConfigs } from './detailRouteConfig';
import type { DetailConfig } from './detailRouteConfig';
import { entityConfigs } from './routeConfig';
import type { EntityConfig } from './routeConfig';

// Entity type definitions
export type EntityType = 'artists' | 'compositions' | 'ragas' | 'talas';
export type EntityItem = {
  id: string;
  name?: string;
  title?: string;
  type?: EntityType;
  createdAt?: string;
  updatedAt?: string;
  viewCount?: number;
  [key: string]: any;
};

// =============================================================================
// URL UTILITIES
// =============================================================================

/**
 * Generate entity URLs using config system
 */
export const entityUrls = {
  // Get index URL for entity type
  index: (entityType: EntityType): string => {
    const config = entityConfigs[entityType];
    return config?.basePath || `/carnatic/${entityType}`;
  },

  // Generate detail URL for entity
  detail: (entityType: EntityType, name: string, id: string): string => {
    const config = entityConfigs[entityType];
    const slug = convert(`${name}-${id}`, { camelCase: false });
    return config ? `${config.basePath}/${slug}` : `/carnatic/${entityType}/${slug}`;
  },

  // Generate search URL with filters
  search: (entityType: EntityType, filters: Record<string, string | number>): string => {
    const config = entityConfigs[entityType];
    const basePath = config?.basePath || `/carnatic/${entityType}`;
    const params = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '' && value !== 'all') {
        params.set(key, value.toString());
      }
    });

    return params.toString() ? `${basePath}?${params.toString()}` : basePath;
  },

  // Extract ID from slug
  extractId: (slug: string): string | null => {
    const parts = slug.split('-');
    return parts.pop() || null;
  },

  // Generate canonical URL
  canonical: (path: string): string => {
    return `https://rasika.life${path}`;
  },
};

// =============================================================================
// FORMATTING UTILITIES
// =============================================================================

/**
 * Entity-aware formatting utilities
 */
export const entityFormatters = {
  // Get display name for entity
  getDisplayName: (entity: EntityItem): string => {
    return entity.title || entity.name || 'Unknown';
  },

  // Get entity type label
  getTypeLabel: (entityType: EntityType, plural = false): string => {
    const config = entityConfigs[entityType];
    return plural ? config?.plural || entityType : config?.singular || entityType;
  },

  // Format entity for display in cards/lists
  formatForCard: (entity: EntityItem, entityType: EntityType) => {
    const config = entityConfigs[entityType];
    const displayName = entityFormatters.getDisplayName(entity);

    return {
      id: entity.id,
      title: displayName,
      type: entityType,
      fields: config?.getCardFields?.(entity) || [],
      subtitle: config?.getCardSubtitle?.(entity),
      description: config?.getCardDescription?.(entity),
      image: config?.getCardImage?.(entity),
      metadata: config?.getCardMetadata?.(entity),
    };
  },

  // Truncate text with smart word breaking
  truncate: (text: string, maxLength: number, wordBreak = true): string => {
    if (text.length <= maxLength) return text;

    const truncated = text.substring(0, maxLength);

    if (wordBreak) {
      const lastSpace = truncated.lastIndexOf(' ');
      return lastSpace > 0 ? `${truncated.substring(0, lastSpace)}...` : `${truncated}...`;
    }

    return `${truncated}...`;
  },

  // Format dates consistently
  formatDate: (dateString: string, format: 'short' | 'long' | 'relative' = 'short'): string => {
    const date = new Date(dateString);

    switch (format) {
      case 'long':
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
      case 'relative':
        return getRelativeTimeString(date);
      default:
        return date.toLocaleDateString();
    }
  },

  // Format numbers with localization
  formatNumber: (num: number | undefined, style: 'decimal' | 'compact' = 'decimal'): string => {
    if (num === undefined) return '';

    if (style === 'compact' && num >= 1000) {
      return new Intl.NumberFormat('en-US', {
        notation: 'compact',
        compactDisplay: 'short',
      }).format(num);
    }

    return num.toLocaleString();
  },

  // Format view count specifically
  formatViewCount: (count: number | undefined): string => {
    if (!count) return '';
    return `${entityFormatters.formatNumber(count, 'compact')} view${count === 1 ? '' : 's'}`;
  },

  // Format entity metadata for display
  formatMetadata: (entity: EntityItem): Array<{ label: string; value: string }> => {
    const metadata = [];

    if (entity.updatedAt) {
      metadata.push({
        label: 'Updated',
        value: entityFormatters.formatDate(entity.updatedAt, 'relative'),
      });
    }

    if (entity.viewCount) {
      metadata.push({
        label: 'Views',
        value: entityFormatters.formatViewCount(entity.viewCount),
      });
    }

    return metadata;
  },
};

// =============================================================================
// API UTILITIES
// =============================================================================

/**
 * Entity-aware API utilities
 */
export const entityApi = {
  // Build search parameters for API calls
  buildSearchParams: (
    entityType: EntityType,
    query?: string,
    filters: Record<string, any> = {},
    options: { limit?: number; nextToken?: string } = {}
  ) => {
    const config = entityConfigs[entityType];
    const params: any = {
      query,
      limit: options.limit || config?.defaultLimit || 20,
      nextToken: options.nextToken,
    };

    // Map filter names to API parameter names
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '' && value !== 'all') {
        // Handle special mappings (like raga -> ragaId for compositions)
        if (key === 'raga' && entityType === 'compositions') {
          params.ragaId = value;
        } else if (key === 'tala' && entityType === 'compositions') {
          params.talaId = value;
        } else {
          params[key] = value;
        }
      }
    });

    // Remove undefined values
    Object.keys(params).forEach(key => {
      if (params[key] === undefined) {
        delete params[key];
      }
    });

    return params;
  },

  // Handle API errors consistently
  handleError: (error: unknown, context: string): Response => {
    console.error(`API Error (${context}):`, error);

    if (error instanceof Response) {
      return error;
    }

    return new Response('Internal Server Error', {
      status: 500,
      statusText: `Failed to ${context}`,
    });
  },

  // Get API endpoint name for entity type
  getEndpoint: (entityType: EntityType): string => {
    const config = entityConfigs[entityType];
    return config?.apiEndpoint || entityType.slice(0, -1); // Remove 's' for singular
  },
};

// =============================================================================
// SEO/META UTILITIES
// =============================================================================

/**
 * Entity-aware SEO and meta utilities
 */
export const entitySeo = {
  // Generate page title
  generateTitle: (
    entityType: EntityType,
    entityName?: string,
    action: 'index' | 'detail' | 'search' = 'index',
    searchTerms?: string[]
  ): string => {
    const config = entityConfigs[entityType];
    const typeLabel = config?.plural || entityType;

    switch (action) {
      case 'detail':
        return entityName
          ? `${entityName} - ${config?.singular || entityType} - Indian Classical Music`
          : `${config?.singular || entityType} - Indian Classical Music`;
      case 'search': {
        const terms = searchTerms?.length ? ` "${searchTerms.join(', ')}"` : '';
        return `${typeLabel}${terms} - Indian Classical Music Search`;
      }
      default:
        return config?.title || `${typeLabel} - Indian Classical Music`;
    }
  },

  // Generate meta description
  generateDescription: (
    entityType: EntityType,
    entityData?: EntityItem,
    action: 'index' | 'detail' | 'search' = 'index',
    searchTerms?: string[]
  ): string => {
    const config = entityConfigs[entityType];

    switch (action) {
      case 'detail':
        if (entityData) {
          const detailConfig = detailConfigs[entityType];
          return detailConfig?.descriptionTemplate(entityData) || config?.description || '';
        }
        return config?.description || '';
      case 'search': {
        const terms = searchTerms?.length ? ` matching "${searchTerms.join(', ')}"` : '';
        return `Discover ${config?.plural?.toLowerCase() || entityType}${terms}. ${config?.description || ''}`;
      }
      default:
        return config?.description || '';
    }
  },

  // Generate keywords
  generateKeywords: (
    entityType: EntityType,
    entityData?: EntityItem,
    additionalKeywords: string[] = []
  ): string => {
    const config = entityConfigs[entityType];
    const baseKeywords = config?.keywords?.split(', ') || [];

    if (entityData) {
      const entityName = entityFormatters.getDisplayName(entityData);
      baseKeywords.unshift(entityName);
    }

    return [...baseKeywords, ...additionalKeywords].join(', ');
  },

  // Generate structured data
  generateStructuredData: (
    entityType: EntityType,
    entityData: EntityItem,
    breadcrumbs?: Array<{ name: string; href: string }>
  ) => {
    const detailConfig = detailConfigs[entityType];
    const displayName = entityFormatters.getDisplayName(entityData);

    const baseData = {
      '@context': 'https://schema.org',
      '@type': detailConfig?.schemaType || 'Thing',
      name: displayName,
      description: detailConfig?.descriptionTemplate(entityData) || '',
      dateCreated: entityData.createdAt,
      dateModified: entityData.updatedAt,
      url: entityUrls.canonical(entityUrls.detail(entityType, displayName, entityData.id)),
    };

    // Add breadcrumbs if provided
    if (breadcrumbs) {
      (baseData as any).breadcrumb = {
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbs.map((crumb, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: crumb.name,
          item: entityUrls.canonical(crumb.href),
        })),
      };
    }

    // Add entity-specific structured data
    if (entityType === 'artists') {
      return {
        ...baseData,
        jobTitle: entityData.artistType,
        knowsAbout: entityData.traditions?.join(', '),
        ...(entityData.profileImage && { image: entityData.profileImage }),
      };
    }
    if (entityType === 'compositions') {
      return {
        ...baseData,
        alternateName: entityData.alternativeTitles,
        inLanguage: entityData.language,
        text: entityData.lyrics,
        musicalKey: entityData.ragaName,
        ...(entityData.attributions?.length > 0 && {
          composer: {
            '@type': 'Person',
            name: entityData.attributions[0].artistName,
          },
        }),
      };
    }

    return baseData;
  },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

// Get relative time string (e.g., "2 days ago")
function getRelativeTimeString(date: Date): string {
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInDays === 0) return 'Today';
  if (diffInDays === 1) return 'Yesterday';
  if (diffInDays < 7) return `${diffInDays} days ago`;
  if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
  if (diffInDays < 365) return `${Math.floor(diffInDays / 30)} months ago`;

  return `${Math.floor(diffInDays / 365)} years ago`;
}

// =============================================================================
// GENERIC FACTORY FUNCTIONS
// =============================================================================

/**
 * Factory functions that create entity-specific utilities
 */
export const createEntityUtils = (entityType: EntityType) => ({
  urls: {
    index: () => entityUrls.index(entityType),
    detail: (name: string, id: string) => entityUrls.detail(entityType, name, id),
    search: (filters: Record<string, string | number>) => entityUrls.search(entityType, filters),
  },

  formatters: {
    forCard: (entity: EntityItem) => entityFormatters.formatForCard(entity, entityType),
    typeLabel: (plural = false) => entityFormatters.getTypeLabel(entityType, plural),
  },

  api: {
    buildSearchParams: (query?: string, filters = {}, options = {}) =>
      entityApi.buildSearchParams(entityType, query, filters, options),
    endpoint: () => entityApi.getEndpoint(entityType),
  },

  seo: {
    title: (entityName?: string, action?: 'index' | 'detail' | 'search', searchTerms?: string[]) =>
      entitySeo.generateTitle(entityType, entityName, action, searchTerms),
    description: (
      entityData?: EntityItem,
      action?: 'index' | 'detail' | 'search',
      searchTerms?: string[]
    ) => entitySeo.generateDescription(entityType, entityData, action, searchTerms),
    keywords: (entityData?: EntityItem, additionalKeywords?: string[]) =>
      entitySeo.generateKeywords(entityType, entityData, additionalKeywords),
    structuredData: (entityData: EntityItem, breadcrumbs?: Array<{ name: string; href: string }>) =>
      entitySeo.generateStructuredData(entityType, entityData, breadcrumbs),
  },
});

// Pre-created utilities for each entity type
export const artistUtils = createEntityUtils('artists');
export const compositionUtils = createEntityUtils('compositions');
export const ragaUtils = createEntityUtils('ragas');
export const talaUtils = createEntityUtils('talas');
