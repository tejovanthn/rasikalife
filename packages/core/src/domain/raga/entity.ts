import { Entity } from 'electrodb';
import type { EntityItem } from 'electrodb';
import { dynamoClient } from '../../db/client';

export const RagaEntity = new Entity(
  {
    model: {
      entity: 'raga',
      version: '1',
      service: 'rasikalife',
    },
    attributes: {
      id: {
        type: 'string',
        required: true,
      },
      name: {
        type: 'string',
        required: true,
      },
      description: {
        type: 'string',
        required: false,
      },
      tradition: {
        type: 'string',
        required: false,
      },
      arohanam: {
        type: 'string',
        required: false,
      },
      avarohanam: {
        type: 'string',
        required: false,
      },
      alternateScales: {
        type: 'list',
        items: { type: 'string' },
        required: false,
      },
      rasa: {
        type: 'string',
        required: false,
      },
      timeOfDay: {
        type: 'string',
        required: false,
      },
      season: {
        type: 'string',
        required: false,
      },
      melaNumber: {
        type: 'number',
        required: false,
      },
      parentRaga: {
        type: 'map',
        properties: {
          id: { type: 'string', required: true },
          name: { type: 'string', required: true },
        },
        required: false,
      },
      deletedAt: {
        type: 'string',
        required: false,
      },
      mergedIntoId: {
        type: 'string',
        required: false,
      },
      performanceCount: {
        type: 'number',
        required: false,
        default: () => 0,
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
          template: 'RAGA#${id}',
        },
        sk: {
          field: 'sk',
          composite: [],
          template: '#METADATA',
        },
      },
      byName: {
        index: 'gsi1',
        pk: {
          field: 'gsi1pk',
          composite: ['name'],
          template: 'RAGA_NAME#${name}',
        },
        sk: {
          field: 'gsi1sk',
          composite: ['id'],
          template: 'RAGA#${id}',
        },
      },
      list: {
        index: 'gsi2',
        pk: {
          field: 'gsi2pk',
          composite: [],
          template: 'RAGA_LIST',
        },
        sk: {
          field: 'gsi2sk',
          composite: ['name', 'id'],
          template: '${name}#${id}',
        },
      },
    },
  },
  { client: dynamoClient, table: process.env.DYNAMODB_TABLE || 'RasikaLifeTable' }
);

// Type inference from ElectroDB entity - automatically inferred from entity configuration
export type Raga = EntityItem<typeof RagaEntity>;

// Alias documenting that name, arohanam, avarohanam, alternateScales[] are stored in ITRANS
export type ItransText = string;
