import { Entity } from 'electrodb';
import type { EntityItem } from 'electrodb';
import { dynamoClient } from '../../db/client';

/**
 * A hall or room inside a venue. pk `VENUE#${venueId}` is the venue's own pk, so a venue and its
 * spaces load in one query (`VenueEntity` rows have sk `#METADATA`, spaces `SPACE#...`).
 * No GSI. There is no delete in v1.
 */
export const VenueSpaceEntity = new Entity(
  {
    model: {
      entity: 'venue_space',
      version: '1',
      service: 'rasikalife',
    },
    attributes: {
      venueId: { type: 'string', required: true },
      spaceId: { type: 'string', required: true },
      name: { type: 'string', required: true },
      capacity: { type: 'number', required: false },
      notes: { type: 'string', required: false },
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
        pk: { field: 'pk', composite: ['venueId'], template: 'VENUE#${venueId}' },
        sk: { field: 'sk', composite: ['spaceId'], template: 'SPACE#${spaceId}' },
      },
    },
  },
  { client: dynamoClient, table: process.env.DYNAMODB_TABLE || 'RasikaLifeTable' }
);

export type VenueSpace = EntityItem<typeof VenueSpaceEntity>;
