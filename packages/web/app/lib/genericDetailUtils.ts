import type { LoaderFunction, MetaFunction } from '@remix-run/node';
import { json } from '@remix-run/node';
import { client } from '~/api.server';
import type { DetailConfig } from './detailRouteConfig';
import { extractIdFromSlug, handleApiError } from './utils';

// Generic detail loader factory
export function createDetailLoader(config: DetailConfig): LoaderFunction {
  return async ({ params, request }) => {
    const paramValue = params[config.paramName];
    if (!paramValue) {
      throw new Response('Not Found', {
        status: 404,
        statusText: `${config.singular} ID is required`,
      });
    }

    // Extract ID from slug (format: "entity-name-ENTITY_ID")
    const entityId = extractIdFromSlug(paramValue);
    if (!entityId) {
      throw new Response(`Invalid ${config.singular.toLowerCase()} ID format`, {
        status: 400,
        statusText: 'Invalid URL format',
      });
    }

    try {
      // Get entity details with view tracking
      const entity = await (client as any)[config.apiEndpoint].getById({
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
      });
    } catch (error) {
      console.error(`Error loading ${config.singular.toLowerCase()}:`, error);
      throw handleApiError(error);
    }
  };
}

// Generic detail meta factory
export function createDetailMeta(config: DetailConfig): MetaFunction {
  return ({ data, params, location }) => {
    const canonicalUrl = `https://rasika.life${location.pathname}`;

    if (!data?.entity) {
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
    const title = config.titleTemplate(entity);
    const description = config.descriptionTemplate(entity);
    const keywords = config.keywordsTemplate(entity);

    // Base meta tags
    const metaTags: any[] = [
      { title },
      { name: 'description', content: description },
      { name: 'keywords', content: keywords },
      { rel: 'canonical', href: canonicalUrl },

      // OpenGraph
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:type', content: config.schemaType === 'Person' ? 'profile' : 'article' },
      { property: 'og:url', content: canonicalUrl },
      { property: 'og:site_name', content: 'Rasika.life' },

      // Twitter Card
      { name: 'twitter:card', content: 'summary' },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
    ];

    // Add image if available
    if (config.hasImage && config.imageField && entity[config.imageField]) {
      metaTags.push({ property: 'og:image', content: entity[config.imageField] });
    }

    // Build structured data based on schema type
    let structuredData: any = {
      '@context': 'https://schema.org',
      '@type': config.schemaType,
      name: entity[config.nameField],
      description: description,
      dateCreated: entity.createdAt,
      dateModified: entity.updatedAt,
      url: canonicalUrl,
      breadcrumb: {
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbs.map((crumb: any, index: number) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: crumb.name,
          item: `https://rasika.life${crumb.href}`,
        })),
      },
    };

    // Add type-specific structured data
    if (config.schemaType === 'Person') {
      structuredData = {
        ...structuredData,
        jobTitle: entity[config.subtitleField || ''],
        knowsAbout: entity.traditions?.join(', '),
        ...(config.hasImage &&
          config.imageField &&
          entity[config.imageField] && {
            image: entity[config.imageField],
          }),
      };
    } else if (config.schemaType === 'MusicComposition') {
      structuredData = {
        ...structuredData,
        alternateName: entity.alternativeTitles,
        inLanguage: entity.language,
        text: entity.lyrics,
        musicalKey: entity.ragaName,
        ...(entity.attributions?.length > 0 && {
          composer: {
            '@type': 'Person',
            name: entity.attributions[0].artistName,
          },
        }),
      };
    } else if (config.schemaType === 'Article') {
      structuredData = {
        ...structuredData,
        ...(entity.melakarta && { identifier: `Melakarta ${entity.melakarta}` }),
      };
    }

    metaTags.push({
      'script:ld+json': structuredData,
    });

    return metaTags;
  };
}
