import { Entity } from 'electrodb';
import type { EntityItem } from 'electrodb';
import { dynamoClient } from '../../db/client';

export const ChangeHistoryEntity = new Entity(
  {
    model: {
      entity: 'change_history',
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
      timestamp: {
        type: 'number',
        required: true,
        default: () => Date.now(),
      },
      action: {
        type: 'string',
        required: true,
      },
      diff: {
        type: 'list',
        items: {
          type: 'map',
          properties: {
            field: { type: 'string', required: true },
            oldValue: { type: 'any', required: false },
            newValue: { type: 'any', required: false },
          },
        },
        required: true,
        default: () => [],
      },
      comment: {
        type: 'string',
        required: false,
      },
    },
    indexes: {
      primary: {
        pk: {
          field: 'pk',
          composite: ['entityType', 'entityId'],
          template: 'ENTITY#${entityType}#${entityId}',
        },
        sk: {
          field: 'sk',
          composite: ['timestamp', 'userId', 'id'],
          template: 'CHANGE#${timestamp}#${userId}#${id}',
        },
      },
      byUser: {
        index: 'gsi1',
        pk: {
          field: 'gsi1pk',
          composite: ['userId'],
          template: 'USER#${userId}',
        },
        sk: {
          field: 'gsi1sk',
          composite: ['timestamp', 'id'],
          template: '${timestamp}#${id}',
        },
      },
    },
  },
  { client: dynamoClient, table: process.env.DYNAMODB_TABLE || 'RasikaLifeTable' }
);

export type ChangeHistory = EntityItem<typeof ChangeHistoryEntity>;
