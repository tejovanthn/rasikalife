import { Entity } from 'electrodb';
import type { EntityItem } from 'electrodb';
import { dynamoClient } from '../../db/client';

export const FestivalEntity = new Entity(
  {
    model: {
      entity: 'festival',
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
      startDate: {
        type: 'string',
        required: true,
      },
      endDate: {
        type: 'string',
        required: true,
      },
      posterUrl: {
        type: 'string',
        required: false,
      },
      posterUploadId: {
        type: 'string',
        required: false,
      },
      organiserId: {
        type: 'string',
        required: false,
      },
      organiserName: {
        type: 'string',
        required: false,
      },
      tags: {
        type: 'list',
        items: { type: 'string' },
        required: false,
        default: () => [],
      },
      sponsors: {
        type: 'any',
        required: false,
      },
      status: {
        type: 'string',
        required: true,
        default: 'draft',
      },

      // Moderator tracking
      moderatorId: { type: 'string', required: false },
      moderatorNote: { type: 'string', required: false },
      submittedAt: { type: 'string', required: false },
      processedAt: { type: 'string', required: false },
      createdBy: {
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
          template: 'FESTIVAL#${id}',
        },
        sk: {
          field: 'sk',
          composite: [],
          template: '#METADATA',
        },
      },
      byCreator: {
        index: 'gsi1',
        pk: {
          field: 'gsi1pk',
          composite: ['createdBy'],
          template: 'USER#${createdBy}',
        },
        sk: {
          field: 'gsi1sk',
          composite: ['createdAt'],
          template: 'FESTIVAL#${createdAt}',
        },
      },
      byStatus: {
        index: 'gsi2',
        pk: {
          field: 'gsi2pk',
          composite: ['status'],
          template: 'FESTIVAL_STATUS#${status}',
        },
        sk: {
          field: 'gsi2sk',
          composite: ['startDate'],
        },
      },
    },
  },
  { client: dynamoClient, table: process.env.DYNAMODB_TABLE || 'RasikaLifeTable' }
);

export type Festival = EntityItem<typeof FestivalEntity>;
