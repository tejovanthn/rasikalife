import { Entity } from 'electrodb';
import type { EntityItem } from 'electrodb';
import { dynamoClient } from '../../db/client';

export const VenueEntity = new Entity(
  {
    model: {
      entity: 'venue',
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
      city: {
        type: 'string',
        required: false,
      },
      mapLink: {
        type: 'string',
        required: false,
      },
      description: {
        type: 'string',
        required: false,
      },
      venueType: {
        type: 'string',
        required: false,
      },
      capacity: {
        type: 'number',
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
          template: 'VENUE#${id}',
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
          template: 'VENUE_NAME#${name}',
        },
        sk: {
          field: 'gsi1sk',
          composite: ['id'],
          template: 'VENUE#${id}',
        },
      },
      list: {
        index: 'gsi2',
        pk: {
          field: 'gsi2pk',
          composite: [],
          template: 'VENUE_LIST',
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
          template: 'VENUE_CITY#${city}',
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

export type Venue = EntityItem<typeof VenueEntity>;
