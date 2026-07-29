import { Entity } from 'electrodb';
import type { EntityItem } from 'electrodb';
import { dynamoClient } from '../../db/client';

/**
 * Press and media coverage of an artist: reviews, interviews, features, recordings.
 *
 * Its own entity rather than a list on the Artist row, for the reason §4.7 gives for
 * ArtistPhoto — an unbounded list eventually meets the 400KB item ceiling, and each item
 * wants its own fields and its own lifecycle.
 *
 * Deliberately no GSI. The sort key is just the id, and callers sort by date in memory:
 * an artist has tens of these, not thousands, which is the same call `getGroupMembers`
 * makes. Putting the date in the sort key would order the partition for free but would
 * make correcting a publication date a delete-and-recreate, and five of the table's six
 * index slots are already spoken for.
 */
export const ArtistMediaEntity = new Entity(
  {
    model: {
      entity: 'artistMedia',
      version: '1',
      service: 'rasikalife',
    },
    attributes: {
      id: { type: 'string', required: true },
      artistId: { type: 'string', required: true },
      title: { type: 'string', required: true },
      url: { type: 'string', required: true },
      mediaType: {
        type: ['article', 'review', 'interview', 'video', 'feature'] as const,
        required: true,
      },
      outlet: { type: 'string', required: false },
      /** YYYY-MM-DD. A publication date is a day, not an instant. */
      publishedOn: { type: 'string', required: false },
      imageUrl: { type: 'string', required: false },
      uploadId: { type: 'string', required: false },
      createdBy: { type: 'string', required: true },
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
          template: 'MEDIA#${id}',
        },
      },
    },
  },
  { client: dynamoClient, table: process.env.DYNAMODB_TABLE || 'RasikaLifeTable' }
);

export type ArtistMedia = EntityItem<typeof ArtistMediaEntity>;
