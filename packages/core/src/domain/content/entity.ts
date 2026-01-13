import { Entity } from 'electrodb';
import type { EntityItem } from 'electrodb';
import { dynamoClient } from '../../db/client';
import { ContentCategory, ContentStatus, ContentVisibility } from '../../types';

export const ContentEntity = new Entity(
  {
    model: {
      entity: 'content',
      version: '1',
      service: 'rasikalife',
    },
    attributes: {
      id: {
        type: 'string',
        required: true,
      },
      path: {
        type: 'string',
        required: true,
      },
      content: {
        type: 'string',
        required: true,
      },
      category: {
        type: 'string',
        required: true,
        enum: Object.values(ContentCategory),
      },
      status: {
        type: 'string',
        required: true,
        enum: Object.values(ContentStatus),
      },
      visibility: {
        type: 'string',
        required: true,
        enum: Object.values(ContentVisibility),
      },
      editorId: {
        type: 'string',
        required: true,
      },
      meta: {
        type: 'map',
        properties: {
          title: { type: 'string', required: true },
          description: { type: 'string', required: true },
          keywords: { type: 'list', items: { type: 'string' }, required: true },
          robots: { type: 'string', required: false },
        },
        required: true,
      },
      navigation: {
        type: 'map',
        properties: {
          breadcrumbs: {
            type: 'list',
            items: {
              type: 'map',
              properties: {
                label: { type: 'string', required: true },
                path: { type: 'string', required: true },
              },
            },
            required: true,
          },
          menuPlacement: {
            type: 'map',
            properties: {
              section: { type: 'string', required: true },
              order: { type: 'number', required: true },
            },
            required: false,
          },
          relatedPages: {
            type: 'list',
            items: {
              type: 'map',
              properties: {
                title: { type: 'string', required: true },
                path: { type: 'string', required: true },
                description: { type: 'string', required: false },
              },
            },
            required: true,
          },
        },
        required: false,
      },
      createdAt: {
        type: 'string',
        required: true,
        default: () => new Date().toISOString(),
        readOnly: true,
      },
      updatedAt: {
        type: 'string',
        required: true,
        default: () => new Date().toISOString(),
        set: () => new Date().toISOString(),
        watch: '*',
      },
    },
    indexes: {
      primary: {
        pk: {
          field: 'pk',
          composite: ['id'],
          template: 'CONTENT#${id}',
        },
        sk: {
          field: 'sk',
          composite: [],
          template: '#METADATA',
        },
      },
      byPath: {
        index: 'gsi1',
        pk: {
          field: 'gsi1pk',
          composite: ['path'],
          template: 'CONTENT_PATH#${path}',
        },
        sk: {
          field: 'gsi1sk',
          composite: ['id'],
          template: 'CONTENT#${id}',
        },
      },
      byCategory: {
        index: 'gsi2',
        pk: {
          field: 'gsi2pk',
          composite: ['category'],
          template: 'CONTENT_CATEGORY#${category}',
        },
        sk: {
          field: 'gsi2sk',
          composite: ['id'],
          template: 'CONTENT#${id}',
        },
      },
      list: {
        index: 'gsi3',
        pk: {
          field: 'gsi3pk',
          composite: [],
          template: 'CONTENT_LIST',
        },
        sk: {
          field: 'gsi3sk',
          composite: ['updatedAt', 'id'],
          template: '${updatedAt}#${id}',
        },
      },
    },
  },
  { client: dynamoClient, table: process.env.DYNAMODB_TABLE || 'RasikaLifeTable' }
);

export type Content = EntityItem<typeof ContentEntity>;
