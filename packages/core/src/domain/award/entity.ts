import { Entity } from 'electrodb';
import type { EntityItem } from 'electrodb';
import { dynamoClient } from '../../db/client';

export const AwardEntity = new Entity(
  {
    model: {
      entity: 'award',
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
      rank: {
        type: 'number',
        required: false,
      },
      issuingOrganisationId: {
        type: 'string',
        required: false,
      },
      issuingOrganisationName: {
        type: 'string',
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
          template: 'AWARD#${id}',
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
          template: 'AWARD_NAME#${name}',
        },
        sk: {
          field: 'gsi1sk',
          composite: ['id'],
          template: 'AWARD#${id}',
        },
      },
      list: {
        index: 'gsi6',
        pk: {
          field: 'gsi6pk',
          composite: [],
          template: 'AWARD_LIST',
        },
        sk: {
          field: 'gsi6sk',
          composite: ['name', 'id'],
          template: '${name}#${id}',
        },
      },
    },
  },
  { client: dynamoClient, table: process.env.DYNAMODB_TABLE || 'RasikaLifeTable' }
);

export type Award = EntityItem<typeof AwardEntity>;
