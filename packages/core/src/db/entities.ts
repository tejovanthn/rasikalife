import { Entity } from 'electrodb';
import { dynamoClient } from '../db/client';

export const ArtistEntity = new Entity(
  {
    model: {
      entity: 'artist',
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
          template: 'ARTIST#${id}',
        },
        sk: {
          field: 'sk',
          composite: [],
          template: '#METADATA',
        },
      },
    },
  },
  { client: dynamoClient, table: process.env.DYNAMODB_TABLE || 'RasikaLifeTable' }
);

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
      artistId: {
        type: 'string',
        required: true,
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
          template: 'COMPOSITION#${id}',
        },
        sk: {
          field: 'sk',
          composite: [],
          template: '#METADATA',
        },
      },
      byArtist: {
        index: 'gsi1',
        pk: {
          field: 'gsi1pk',
          composite: ['artistId'],
          template: 'ARTIST#${artistId}',
        },
        sk: {
          field: 'gsi1sk',
          composite: ['id'],
          template: 'COMPOSITION#${id}',
        },
      },
    },
  },
  { client: dynamoClient, table: process.env.DYNAMODB_TABLE || 'RasikaLifeTable' }
);

// Type inference from ElectroDB entities
export type Artist = Parameters<typeof ArtistEntity.create>[0] & {
  id: string;
  createdAt: string;
  updatedAt: string;
};

export type Composition = Parameters<typeof CompositionEntity.create>[0] & {
  id: string;
  createdAt: string;
  updatedAt: string;
};
