import { Entity } from 'electrodb';
import type { EntityItem } from 'electrodb';
import { dynamoClient } from '../../db/client';

export const CompositionEntity = new Entity(
  {
    model: {
      entity: 'composition',
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
      composerId: {
        type: 'string',
        required: true,
      },
      composer: {
        type: 'map',
        properties: {
          id: { type: 'string', required: true },
          name: { type: 'string', required: true },
        },
        required: true,
      },
      language: {
        type: 'string',
        required: true,
      },
      lyricsV1: {
        type: 'list',
        items: {
          type: 'map',
          properties: {
            type: { type: 'string', required: true },
            order: { type: 'number', required: true },
            text: { type: 'string', required: true },
            number: { type: 'number', required: false },
            ragaName: { type: 'string', required: false },
          },
        },
        required: false,
        default: () => [],
      },
      ragas: {
        type: 'list',
        items: {
          type: 'map',
          properties: {
            id: { type: 'string', required: true },
            name: { type: 'string', required: true },
          },
        },
        required: false,
        default: () => [],
      },
      talas: {
        type: 'list',
        items: {
          type: 'map',
          properties: {
            id: { type: 'string', required: true },
            name: { type: 'string', required: true },
          },
        },
        required: false,
        default: () => [],
      },
      sourceAttribution: {
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
      version: {
        type: 'number',
        required: true,
        default: () => 1,
      },
      lastEditedBy: {
        type: 'string',
        required: false,
      },
      deletedAt: {
        type: 'string',
        required: false,
      },
    },
    indexes: {
      primary: {
        pk: {
          field: 'pk',
          composite: ['id'],
          template: 'COMPOSITION#${id}',
        },
        sk: {
          field: 'sk',
          composite: [],
          template: '#METADATA',
        },
      },
      byComposer: {
        index: 'gsi2',
        pk: {
          field: 'gsi2pk',
          composite: ['composerId'],
          template: 'ARTIST#${composerId}',
        },
        sk: {
          field: 'gsi2sk',
          composite: ['id'],
          template: 'COMPOSITION#${id}',
        },
      },
      byLanguage: {
        index: 'gsi3',
        pk: {
          field: 'gsi3pk',
          composite: ['language'],
          template: 'LANGUAGE#${language}',
        },
        sk: {
          field: 'gsi3sk',
          composite: ['id'],
          template: 'COMPOSITION#${id}',
        },
      },
      byName: {
        index: 'gsi4',
        pk: {
          field: 'gsi4pk',
          composite: ['title'],
          template: 'COMPOSITION_NAME#${title}',
        },
        sk: {
          field: 'gsi4sk',
          composite: ['id'],
          template: 'COMPOSITION#${id}',
        },
      },
      list: {
        index: 'gsi5',
        pk: {
          field: 'gsi5pk',
          composite: [],
          template: 'COMPOSITION_LIST',
        },
        sk: {
          field: 'gsi5sk',
          composite: ['title', 'id'],
          template: '${title}#${id}',
        },
      },
    },
  },
  { client: dynamoClient, table: process.env.DYNAMODB_TABLE || 'RasikaLifeTable' }
);

// Type inference from ElectroDB entity - automatically inferred from entity configuration
export type Composition = EntityItem<typeof CompositionEntity>;
