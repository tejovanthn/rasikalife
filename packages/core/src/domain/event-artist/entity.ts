import { Entity } from 'electrodb';
import type { EntityItem } from 'electrodb';
import { dynamoClient } from '../../db/client';

export const EventArtistEntity = new Entity(
  {
    model: {
      entity: 'eventArtist',
      version: '1',
      service: 'rasikalife',
    },
    attributes: {
      eventId: {
        type: 'string',
        required: true,
      },
      artistId: {
        type: 'string',
        required: true,
      },

      // Denormalized for display (avoid extra lookups)
      eventTitle: { type: 'string', required: true },
      eventStartDateTime: { type: 'string', required: true },
      artistName: { type: 'string', required: true },
      artistTitle: { type: 'string', required: false },
      role: { type: 'string', required: false },

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
          composite: ['eventId'],
          template: 'EVENT#${eventId}',
        },
        sk: {
          field: 'sk',
          composite: ['artistId'],
          template: 'ARTIST#${artistId}',
        },
      },
      byArtist: {
        index: 'gsi1',
        pk: {
          field: 'gsi1pk',
          composite: ['artistId'],
          template: 'ARTIST_EVENTS#${artistId}',
        },
        sk: {
          field: 'gsi1sk',
          composite: ['eventStartDateTime'],
        },
      },
    },
  },
  { client: dynamoClient, table: process.env.DYNAMODB_TABLE || 'RasikaLifeTable' }
);

export type EventArtist = EntityItem<typeof EventArtistEntity>;
