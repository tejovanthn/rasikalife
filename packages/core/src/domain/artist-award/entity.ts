import { Entity } from 'electrodb';
import type { EntityItem } from 'electrodb';
import { dynamoClient } from '../../db/client';

export const ArtistAwardEntity = new Entity(
  {
    model: {
      entity: 'artistAward',
      version: '1',
      service: 'rasikalife',
    },
    attributes: {
      artistId: {
        type: 'string',
        required: true,
      },
      artistName: {
        type: 'string',
        required: true,
      },
      awardId: {
        type: 'string',
        required: true,
      },
      awardName: {
        type: 'string',
        required: true,
      },
      rank: {
        type: 'number',
        required: false,
      },
      year: {
        type: 'number',
        required: false,
      },
      category: {
        type: 'string',
        required: false,
      },
      notes: {
        type: 'string',
        required: false,
      },
      createdAt: {
        type: 'string',
        required: true,
        default: () => new Date().toISOString(),
        readOnly: true,
      },
    },
    indexes: {
      primary: {
        pk: {
          field: 'pk',
          composite: ['artistId'],
          template: 'ARTIST#${artistId}',
        },
        sk: {
          field: 'sk',
          composite: ['awardId'],
          template: 'AWARD#${awardId}',
        },
      },
      byAward: {
        index: 'gsi1',
        pk: {
          field: 'gsi1pk',
          composite: ['awardId'],
          template: 'AWARD#${awardId}',
        },
        sk: {
          field: 'gsi1sk',
          composite: ['artistId'],
          template: 'ARTIST#${artistId}',
        },
      },
    },
  },
  { client: dynamoClient, table: process.env.DYNAMODB_TABLE || 'RasikaLifeTable' }
);

export type ArtistAward = EntityItem<typeof ArtistAwardEntity>;
