import { Entity } from 'electrodb';
import type { EntityItem } from 'electrodb';
import { dynamoClient } from '../../db/client';

export const CompositionTalaEntity = new Entity(
  {
    model: {
      entity: 'composition_tala',
      version: '1',
      service: 'rasikalife',
    },
    attributes: {
      compositionId: {
        type: 'string',
        required: true,
      },
      talaId: {
        type: 'string',
        required: true,
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
          composite: ['compositionId'],
          template: 'COMPOSITION#${compositionId}',
        },
        sk: {
          field: 'sk',
          composite: ['talaId'],
          template: 'TALA#${talaId}',
        },
      },
      byTala: {
        index: 'gsi1',
        pk: {
          field: 'gsi1pk',
          composite: ['talaId'],
          template: 'TALA#${talaId}',
        },
        sk: {
          field: 'gsi1sk',
          composite: ['compositionId'],
          template: 'COMPOSITION#${compositionId}',
        },
      },
    },
  },
  { client: dynamoClient, table: process.env.DYNAMODB_TABLE || 'RasikaLifeTable' }
);

export type CompositionTala = EntityItem<typeof CompositionTalaEntity>;
