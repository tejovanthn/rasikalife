import { Entity } from 'electrodb';
import type { EntityItem } from 'electrodb';
import { dynamoClient } from '../../db/client';

export const ConcertLogEntity = new Entity(
  {
    model: {
      entity: 'concertLog',
      version: '1',
      service: 'rasikalife',
    },
    attributes: {
      userId: {
        type: 'string',
        required: true,
      },
      eventId: {
        type: 'string',
        required: true,
      },
      eventTitle: {
        type: 'string',
        required: true,
      },
      eventStartDateTime: {
        type: 'string',
        required: true,
      },
      venueName: {
        type: 'string',
        required: false,
      },
      artistNames: {
        type: 'list',
        items: { type: 'string' },
        required: false,
        default: () => [],
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
          composite: ['userId'],
          template: 'USER#${userId}',
        },
        sk: {
          field: 'sk',
          composite: ['eventId'],
          template: 'CONCERT_LOG#${eventId}',
        },
      },
      byUserDate: {
        index: 'gsi1',
        pk: {
          field: 'gsi1pk',
          composite: ['userId'],
          template: 'USER_CONCERTS#${userId}',
        },
        sk: {
          field: 'gsi1sk',
          composite: ['eventStartDateTime', 'eventId'],
          template: '${eventStartDateTime}#${eventId}',
        },
      },
      byEvent: {
        index: 'gsi2',
        pk: {
          field: 'gsi2pk',
          composite: ['eventId'],
          template: 'EVENT_LOGS#${eventId}',
        },
        sk: {
          field: 'gsi2sk',
          composite: ['createdAt', 'userId'],
          template: '${createdAt}#${userId}',
        },
      },
    },
  },
  { client: dynamoClient, table: process.env.DYNAMODB_TABLE || 'RasikaLifeTable' }
);

export type ConcertLog = EntityItem<typeof ConcertLogEntity>;
