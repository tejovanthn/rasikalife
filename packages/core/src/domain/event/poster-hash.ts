import { Entity } from 'electrodb';
import type { EntityItem } from 'electrodb';
import { dynamoClient } from '../../db/client';

export const PosterHashEntity = new Entity(
  {
    model: {
      entity: 'posterHash',
      version: '1',
      service: 'rasikalife',
    },
    attributes: {
      hash: {
        type: 'string',
        required: true,
      },
      posterUploadId: {
        type: 'string',
        required: true,
      },
      posterUrl: {
        type: 'string',
        required: true,
      },
      festivalId: {
        type: 'string',
        required: false,
      },
      eventIds: {
        type: 'list',
        items: { type: 'string' },
        required: true,
        default: () => [],
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
    },
    indexes: {
      primary: {
        pk: {
          field: 'pk',
          composite: ['hash'],
          template: 'POSTER_HASH#${hash}',
        },
        sk: {
          field: 'sk',
          composite: [],
          template: '#METADATA',
        },
      },
    },
  },
  { client: dynamoClient, table: process.env.DYNAMODB_TABLE || 'RasikaLifeTable' }
);

export type PosterHashRecord = EntityItem<typeof PosterHashEntity>;

export async function getPosterByHash(hash: string): Promise<PosterHashRecord | null> {
  const result = await PosterHashEntity.get({ hash }).go();
  return (result.data as PosterHashRecord) || null;
}

export async function savePosterHash(record: {
  hash: string;
  posterUploadId: string;
  posterUrl: string;
  festivalId?: string;
  eventIds: string[];
  createdBy: string;
}): Promise<void> {
  await PosterHashEntity.upsert({
    hash: record.hash,
    posterUploadId: record.posterUploadId,
    posterUrl: record.posterUrl,
    festivalId: record.festivalId,
    eventIds: record.eventIds,
    createdBy: record.createdBy,
  }).go();
}
