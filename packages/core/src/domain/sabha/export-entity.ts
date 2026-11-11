import { Entity } from 'electrodb';
import type { EntityItem } from 'electrodb';
import { dynamoClient } from '../../db/client';

/**
 * The audit row of one follower export: who downloaded it, when, and how many people were in it.
 * It never holds the people themselves. pk `PARTNER_EXPORT#${targetType}#${targetId}` keeps a
 * target's exports in one partition, sorted by time. No GSI.
 *
 * A small entity of its own rather than a `ChangeHistory` row: that log is read back as an
 * entity's field diffs (rollback, state at a time), and an export changes no field.
 */
export const PartnerExportEntity = new Entity(
  {
    model: {
      entity: 'partner_export',
      version: '1',
      service: 'rasikalife',
    },
    attributes: {
      targetType: { type: ['organiser', 'venue'] as const, required: true },
      targetId: { type: 'string', required: true },
      userId: { type: 'string', required: true },
      rowCount: { type: 'number', required: true },
      // The private bucket key. The file is deleted after 7 days; the row stays.
      key: { type: 'string', required: true },
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
          composite: ['targetType', 'targetId'],
          template: 'PARTNER_EXPORT#${targetType}#${targetId}',
        },
        sk: {
          field: 'sk',
          composite: ['createdAt', 'userId'],
          template: '${createdAt}#${userId}',
        },
      },
    },
  },
  { client: dynamoClient, table: process.env.DYNAMODB_TABLE || 'RasikaLifeTable' }
);

export type PartnerExport = EntityItem<typeof PartnerExportEntity>;
