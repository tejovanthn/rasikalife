import { Entity } from 'electrodb';
import type { EntityItem } from 'electrodb';
import { dynamoClient } from '../../db/client';

export const CompositionRagaEntity = new Entity(
  {
    model: {
      entity: 'composition_raga',
      version: '1',
      service: 'rasikalife',
    },
    attributes: {
      compositionId: {
        type: 'string',
        required: true,
      },
      ragaId: {
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
          composite: ['ragaId'],
          template: 'RAGA#${ragaId}',
        },
      },
      byRaga: {
        index: 'gsi1',
        pk: {
          field: 'gsi1pk',
          composite: ['ragaId'],
          template: 'RAGA#${ragaId}',
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

export type CompositionRaga = EntityItem<typeof CompositionRagaEntity>;
