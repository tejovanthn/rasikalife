import { Entity } from 'electrodb';
import type { EntityItem } from 'electrodb';
import { dynamoClient } from '../../db/client';

export const OrganiserEntity = new Entity(
  {
    model: {
      entity: 'organiser',
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
      organisationType: {
        type: 'string',
        required: false,
      },
      city: {
        type: 'string',
        required: false,
      },
      address: {
        type: 'map',
        properties: {
          street: { type: 'string', required: false },
          city: { type: 'string', required: false },
          state: { type: 'string', required: false },
          postalCode: { type: 'string', required: false },
          country: { type: 'string', required: false },
        },
        required: false,
      },
      website: {
        type: 'string',
        required: false,
      },
      phone: {
        type: 'string',
        required: false,
      },
      email: {
        type: 'string',
        required: false,
      },
      socialLinks: {
        type: 'list',
        items: {
          type: 'map',
          properties: {
            platform: { type: 'string', required: true },
            url: { type: 'string', required: true },
          },
        },
        required: false,
      },
      foundedYear: {
        type: 'number',
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
          template: 'ORGANISER#${id}',
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
          template: 'ORGANISER_NAME#${name}',
        },
        sk: {
          field: 'gsi1sk',
          composite: ['id'],
          template: 'ORGANISER#${id}',
        },
      },
      list: {
        index: 'gsi2',
        pk: {
          field: 'gsi2pk',
          composite: [],
          template: 'ORGANISER_LIST',
        },
        sk: {
          field: 'gsi2sk',
          composite: ['name', 'id'],
          template: '${name}#${id}',
        },
      },
      byCity: {
        index: 'gsi3',
        pk: {
          field: 'gsi3pk',
          composite: ['city'],
          template: 'ORGANISER_CITY#${city}',
        },
        sk: {
          field: 'gsi3sk',
          composite: ['name', 'id'],
          template: '${name}#${id}',
        },
      },
    },
  },
  { client: dynamoClient, table: process.env.DYNAMODB_TABLE || 'RasikaLifeTable' }
);

export type Organiser = EntityItem<typeof OrganiserEntity>;
