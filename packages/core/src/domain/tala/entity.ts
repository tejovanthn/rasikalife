import { Entity } from 'electrodb';
import type { EntityItem } from 'electrodb';
import { dynamoClient } from '../../db/client';

export const TalaEntity = new Entity(
  {
    model: {
      entity: 'tala',
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
      aksharas: {
        type: 'number',
        required: false,
      },
      angaStructure: {
        type: 'map',
        properties: {
          jati: { type: 'string', required: false },
          angas: {
            type: 'list',
            items: {
              type: 'map',
              properties: {
                type: { type: 'string', required: false },
              },
            },
            required: false,
          },
          vibhags: {
            type: 'list',
            items: {
              type: 'map',
              properties: {
                matras: { type: 'number', required: false },
                isKhali: { type: 'boolean', required: false },
                label: { type: 'string', required: false },
              },
            },
            required: false,
          },
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
          template: 'TALA#${id}',
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
          template: 'TALA_NAME#${name}',
        },
        sk: {
          field: 'gsi1sk',
          composite: ['id'],
          template: 'TALA#${id}',
        },
      },
      list: {
        index: 'gsi2',
        pk: {
          field: 'gsi2pk',
          composite: [],
          template: 'TALA_LIST',
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
export type Tala = EntityItem<typeof TalaEntity>;
