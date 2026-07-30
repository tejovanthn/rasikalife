import { Entity } from 'electrodb';
import type { EntityItem } from 'electrodb';
import { dynamoClient } from '../../db/client';
import { MAX_PHOTO_ORDER } from './schema';

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
      /**
       * Intrinsic pixel size, captured in the browser at upload time.
       *
       * Optional, and permanently so: every photo stored before this existed has none, and a
       * file the browser cannot decode still uploads. The gallery uses them to reserve each
       * tile's aspect ratio so a masonry column does not reflow as images arrive; without them
       * a tile simply sizes itself on load.
       */
      width: {
        type: 'number',
        required: false,
      },
      height: {
        type: 'number',
        required: false,
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
      // "2"). 4 digits supports up to MAX_PHOTO_ORDER photos for a single artist — far beyond
      // any real gallery. Recomputed automatically whenever `order` is part of an update (see
      // `watch`). The bound is enforced here, next to the key that depends on it, rather than
      // only in the tRPC Zod schema: a core-direct caller passing order ≥ 10000 would otherwise
      // pad to five digits and sort *before* everything, silently jumping to the front.
      orderStr: {
        type: 'string',
        required: false,
        watch: ['order'],
        set: (_val, attrs) => {
          const order = attrs.order ?? 0;
          if (order < 0 || order > MAX_PHOTO_ORDER) {
            throw new Error(
              `ArtistPhoto order ${order} is out of range [0, ${MAX_PHOTO_ORDER}]; it would overflow the zero-padded gallery sort key`
            );
          }
          return order.toString().padStart(4, '0');
        },
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
