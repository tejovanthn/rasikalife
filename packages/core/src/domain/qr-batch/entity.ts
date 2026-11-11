import { Entity } from 'electrodb';
import type { EntityItem } from 'electrodb';
import { dynamoClient } from '../../db/client';

/**
 * One print run. gsi1 lists every batch newest first through a constant partition: batches are
 * a handful a season, so the one partition is small. The key holds no optional attribute.
 */
export const QrBatchEntity = new Entity(
  {
    model: {
      entity: 'qr_batch',
      version: '1',
      service: 'rasikalife',
    },
    attributes: {
      id: { type: 'string', required: true },
      format: { type: ['sticker', 'table-tent', 'poster'] as const, required: true },
      count: { type: 'number', required: true },
      note: { type: 'string', required: false },
      pdfStatus: {
        type: ['pending', 'ready', 'failed'] as const,
        required: true,
        default: () => 'pending' as const,
      },
      pdfKey: { type: 'string', required: false },
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
        watch: '*',
      },
    },
    indexes: {
      primary: {
        pk: { field: 'pk', composite: ['id'], template: 'QR_BATCH#${id}' },
        sk: { field: 'sk', composite: [], template: '#METADATA' },
      },
      list: {
        index: 'gsi1',
        pk: { field: 'gsi1pk', composite: [], template: 'QR_BATCH_LIST' },
        sk: { field: 'gsi1sk', composite: ['createdAt', 'id'], template: '${createdAt}#${id}' },
      },
    },
  },
  { client: dynamoClient, table: process.env.DYNAMODB_TABLE || 'RasikaLifeTable' }
);

export type QrBatch = EntityItem<typeof QrBatchEntity>;
