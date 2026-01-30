import { Entity } from 'electrodb';
import type { EntityItem } from 'electrodb';
import { dynamoClient } from '../../db/client';

export const UserEntity = new Entity(
  {
    model: {
      entity: 'user',
      version: '1',
      service: 'rasikalife',
    },
    attributes: {
      id: {
        type: 'string',
        required: true,
      },
      email: {
        type: 'string',
        required: true,
      },
      name: {
        type: 'string',
        required: true,
      },
      picture: {
        type: 'string',
        required: false,
      },
      googleId: {
        type: 'string',
        required: true,
      },
      createdAt: {
        type: 'string',
        required: true,
        default: () => new Date().toISOString(),
        readOnly: true,
      },
      lastSignedInAt: {
        type: 'string',
        required: true,
        default: () => new Date().toISOString(),
        set: () => new Date().toISOString(),
      },
    },
    indexes: {
      primary: {
        pk: {
          field: 'pk',
          composite: ['id'],
          template: 'USER#${id}',
        },
        sk: {
          field: 'sk',
          composite: [],
          template: '#METADATA',
        },
      },
      byEmail: {
        index: 'gsi1',
        pk: {
          field: 'gsi1pk',
          composite: ['email'],
          template: 'USER_EMAIL#${email}',
        },
        sk: {
          field: 'gsi1sk',
          composite: ['id'],
          template: 'USER#${id}',
        },
      },
      byGoogleId: {
        index: 'gsi2',
        pk: {
          field: 'gsi2pk',
          composite: ['googleId'],
          template: 'USER_GOOGLE_ID#${googleId}',
        },
        sk: {
          field: 'gsi2sk',
          composite: ['id'],
          template: 'USER#${id}',
        },
      },
    },
  },
  { client: dynamoClient, table: process.env.DYNAMODB_TABLE || 'RasikaLifeTable' }
);

export type User = EntityItem<typeof UserEntity>;
