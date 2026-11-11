import { Entity } from 'electrodb';
import type { EntityItem } from 'electrodb';
import { dynamoClient } from '../../db/client';

/**
 * One browser's web push endpoint. pk `USER#${userId}` is the user's own pk; sk is the sha256 of
 * the endpoint, so subscribing twice from one browser writes one row. No GSI.
 */
export const PushSubscriptionEntity = new Entity(
  {
    model: {
      entity: 'push_subscription',
      version: '1',
      service: 'rasikalife',
    },
    attributes: {
      userId: { type: 'string', required: true },
      endpointHash: { type: 'string', required: true },
      endpoint: { type: 'string', required: true },
      p256dh: { type: 'string', required: true },
      auth: { type: 'string', required: true },
      userAgent: { type: 'string', required: false },
      createdAt: {
        type: 'string',
        required: true,
        default: () => new Date().toISOString(),
      },
    },
    indexes: {
      primary: {
        pk: { field: 'pk', composite: ['userId'], template: 'USER#${userId}' },
        sk: { field: 'sk', composite: ['endpointHash'], template: 'PUSH#${endpointHash}' },
      },
    },
  },
  { client: dynamoClient, table: process.env.DYNAMODB_TABLE || 'RasikaLifeTable' }
);

export type PushSubscription = EntityItem<typeof PushSubscriptionEntity>;
