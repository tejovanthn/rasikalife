import { Entity } from 'electrodb';
import type { EntityItem } from 'electrodb';
import { dynamoClient } from '../../db/client';

export const RsvpEntity = new Entity(
  {
    model: {
      entity: 'rsvp',
      version: '1',
      service: 'rasikalife',
    },
    attributes: {
      eventId: {
        type: 'string',
        required: true,
      },
      userId: {
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
      byEvent: {
        pk: {
          field: 'pk',
          composite: ['eventId'],
          template: 'RSVP#${eventId}',
        },
        sk: {
          field: 'sk',
          composite: ['userId'],
          template: 'USER#${userId}',
        },
      },
      byUser: {
        index: 'gsi1',
        pk: {
          field: 'gsi1pk',
          composite: ['userId'],
          template: 'USER_RSVP#${userId}',
        },
        sk: {
          field: 'gsi1sk',
          composite: ['createdAt'],
          template: 'RSVP#${createdAt}',
        },
      },
    },
  },
  { client: dynamoClient, table: process.env.DYNAMODB_TABLE || 'RasikaLifeTable' }
);

export type Rsvp = EntityItem<typeof RsvpEntity>;
