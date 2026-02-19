import { Entity } from 'electrodb';
import type { EntityItem } from 'electrodb';
import { dynamoClient } from '../../db/client';
import { EditStatus } from './types';

export const EditEntity = new Entity(
  {
    model: {
      entity: 'edit',
      version: '1',
      service: 'rasikalife',
    },
    attributes: {
      id: {
        type: 'string',
        required: true,
      },
      entityType: {
        type: 'string',
        required: true,
      },
      entityId: {
        type: 'string',
        required: true,
      },
      userId: {
        type: 'string',
        required: true,
      },
      status: {
        type: 'string',
        enum: Object.values(EditStatus),
        required: true,
        default: EditStatus.DRAFT,
      },
      proposedValues: {
        type: 'any',
        required: true,
      },
      operation: {
        type: 'string',
        enum: ['update', 'delete'],
        required: false,
        default: () => 'update',
      },
      userNote: {
        type: 'string',
        required: false,
      },
      moderatorId: {
        type: 'string',
        required: false,
      },
      moderatorNote: {
        type: 'string',
        required: false,
      },
      submittedAt: {
        type: 'string',
        required: false,
      },
      processedAt: {
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
          template: 'EDIT#${id}',
        },
        sk: {
          field: 'sk',
          composite: [],
          template: '#METADATA',
        },
      },
      byStatus: {
        index: 'gsi1',
        pk: {
          field: 'gsi1pk',
          composite: ['status'],
          template: 'EDIT_STATUS#${status}',
        },
        sk: {
          field: 'gsi1sk',
          composite: ['createdAt'],
        },
      },
      byPendingType: {
        index: 'gsi2',
        pk: {
          field: 'gsi2pk',
          composite: ['status', 'entityType'],
          template: 'EDIT_STATUS#${status}#${entityType}',
        },
        sk: {
          field: 'gsi2sk',
          composite: ['createdAt'],
        },
      },
      byEntity: {
        index: 'gsi3',
        pk: {
          field: 'gsi3pk',
          composite: ['entityType', 'entityId'],
          template: 'EDIT_ENTITY#${entityType}#${entityId}',
        },
        sk: {
          field: 'gsi3sk',
          composite: ['createdAt'],
        },
      },
      byUser: {
        index: 'gsi4',
        pk: {
          field: 'gsi4pk',
          composite: ['userId'],
          template: 'EDIT_USER#${userId}',
        },
        sk: {
          field: 'gsi4sk',
          composite: ['createdAt'],
        },
      },
    },
  },
  { client: dynamoClient, table: process.env.DYNAMODB_TABLE || 'RasikaLifeTable' }
);

export type Edit = EntityItem<typeof EditEntity>;
