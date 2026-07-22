import { Entity } from 'electrodb';
import type { EntityItem } from 'electrodb';
import { dynamoClient } from '../../db/client';

export const ArtistPhotoEntity = new Entity(
  {
    model: {
      entity: 'artistPhoto',
      version: '1',
      service: 'rasikalife',
    },
    attributes: {
      id: {
        type: 'string',
        required: true,
      },
      artistId: {
        type: 'string',
        required: true,
      },
      imageUrl: {
        type: 'string',
        required: true,
      },
      uploadId: {
        type: 'string',
        required: true,
      },
      caption: {
        type: 'string',
        required: false,
      },
      credit: {
        type: 'string',
        required: false,
      },
      order: {
        type: 'number',
        required: true,
        default: () => 0,
      },
      // Zero-padded order string used to build the byArtist GSI sort key, so a lexicographic
      // string comparison agrees with numeric order (a plain `${order}` would sort "10" before
      // "2"). 4 digits supports up to 9999 photos for a single artist — far beyond any real
      // gallery. Recomputed automatically whenever `order` is part of an update (see `watch`).
      orderStr: {
        type: 'string',
        required: false,
        watch: ['order'],
        set: (_val, attrs) => attrs.order?.toString().padStart(4, '0') ?? '0000',
        default: () => '0000',
      },
      featured: {
        type: 'boolean',
        required: true,
        default: () => false,
      },
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
          composite: ['artistId'],
          template: 'ARTIST#${artistId}',
        },
        sk: {
          field: 'sk',
          composite: ['id'],
          template: 'PHOTO#${id}',
        },
      },
      byArtist: {
        index: 'gsi1',
        pk: {
          field: 'gsi1pk',
          composite: ['artistId'],
          template: 'ARTIST_PHOTOS#${artistId}',
        },
        sk: {
          field: 'gsi1sk',
          // id is the tiebreaker so the key stays unique when two photos share an order.
          composite: ['orderStr', 'id'],
          template: '${orderStr}#${id}',
        },
      },
    },
  },
  { client: dynamoClient, table: process.env.DYNAMODB_TABLE || 'RasikaLifeTable' }
);

export type ArtistPhoto = EntityItem<typeof ArtistPhotoEntity>;
