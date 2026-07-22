import { Entity } from 'electrodb';
import type { EntityItem } from 'electrodb';
import { dynamoClient } from '../../db/client';

export const SourceEntity = new Entity(
  {
    model: {
      entity: 'source',
      version: '1',
      service: 'rasikalife',
    },
    attributes: {
      id: {
        type: 'string',
        required: true,
      },
      title: {
        type: 'string',
        required: true,
      },
      subtitle: {
        type: 'string',
        required: false,
      },
      authors: {
        type: 'list',
        items: {
          type: 'map',
          properties: {
            name: { type: 'string', required: true },
            role: { type: 'string', required: false },
          },
        },
        required: false,
        default: () => [],
      },
      publisher: {
        type: 'string',
        required: false,
      },
      publicationYear: {
        type: 'number',
        required: false,
      },
      edition: {
        type: 'string',
        required: false,
      },
      isbn: {
        type: 'string',
        required: false,
      },
      sourceType: {
        type: ['book', 'journal', 'article', 'manuscript', 'other'] as const,
        required: true,
        default: 'book',
      },
      language: {
        type: 'string',
        required: false,
      },
      bookId: {
        type: 'string',
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
          template: 'SOURCE#${id}',
        },
        sk: {
          field: 'sk',
          composite: [],
          template: '#METADATA',
        },
      },
      byBookId: {
        index: 'gsi1',
        pk: {
          field: 'gsi1pk',
          composite: ['bookId'],
          template: 'SOURCE_BOOK#${bookId}',
        },
        sk: {
          field: 'gsi1sk',
          composite: ['id'],
          template: 'SOURCE#${id}',
        },
      },
      list: {
        index: 'gsi2',
        pk: {
          field: 'gsi2pk',
          composite: [],
          template: 'SOURCE_LIST',
        },
        sk: {
          field: 'gsi2sk',
          composite: ['title', 'id'],
          template: '${title}#${id}',
        },
      },
    },
  },
  { client: dynamoClient, table: process.env.DYNAMODB_TABLE || 'RasikaLifeTable' }
);

export type Source = EntityItem<typeof SourceEntity>;
