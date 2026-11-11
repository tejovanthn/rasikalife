import { Entity } from 'electrodb';
import type { EntityItem } from 'electrodb';
import { dynamoClient } from '../../db/client';

/**
 * One printed code. pk `QR#${code}` / sk `#METADATA`, so a code and its `QrScanDay` rollups sit in
 * one item collection.
 *
 * Two indexes, both keyed on required attributes (CLAUDE.md rule 9):
 * - `byVenue` (gsi1) on `venueRef`, never on the optional `venueId`. See `venueRefFor`.
 * - `byStatus` (gsi2) on `status`, which an unassigned code has from birth.
 *
 * Rule 7: ElectroDB silently skips a GSI sort key whose composites a patch did not supply, so
 * every patch that changes `venueRef` also sets `createdAt`, and every patch that changes
 * `status` also sets `batchId`. `createdAt` and `batchId` are therefore not `readOnly`.
 */
export const VenueQrEntity = new Entity(
  {
    model: {
      entity: 'venue_qr',
      version: '1',
      service: 'rasikalife',
    },
    attributes: {
      code: { type: 'string', required: true },
      batchId: { type: 'string', required: true },
      status: {
        type: ['unassigned', 'active', 'retired'] as const,
        required: true,
        default: () => 'unassigned' as const,
      },
      venueId: { type: 'string', required: false },
      // Index discriminator, see `venueRefFor`. Always set explicitly by the operations.
      venueRef: { type: 'string', required: true },
      venueName: { type: 'string', required: false },
      spaceId: { type: 'string', required: false },
      label: { type: 'string', required: false },
      note: { type: 'string', required: false },
      assignedBy: { type: 'string', required: false },
      assignedAt: { type: 'string', required: false },
      retiredAt: { type: 'string', required: false },
      scanCount: { type: 'number', required: true, default: () => 0 },
      followCount: { type: 'number', required: true, default: () => 0 },
      lastScannedAt: { type: 'string', required: false },
      createdAt: {
        type: 'string',
        required: true,
        default: () => new Date().toISOString(),
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
        pk: { field: 'pk', composite: ['code'], template: 'QR#${code}' },
        sk: { field: 'sk', composite: [], template: '#METADATA' },
      },
      byVenue: {
        index: 'gsi1',
        pk: { field: 'gsi1pk', composite: ['venueRef'], template: 'VENUE_QRS#${venueRef}' },
        sk: {
          field: 'gsi1sk',
          composite: ['createdAt', 'code'],
          template: '${createdAt}#${code}',
        },
      },
      byStatus: {
        index: 'gsi2',
        pk: { field: 'gsi2pk', composite: ['status'], template: 'QR_STATUS#${status}' },
        sk: { field: 'gsi2sk', composite: ['batchId', 'code'], template: '${batchId}#${code}' },
      },
    },
  },
  { client: dynamoClient, table: process.env.DYNAMODB_TABLE || 'RasikaLifeTable' }
);

/**
 * Daily scan and follow rollup for one code. Same pk as `VenueQr`, sk `SCAN_DAY#${date}`; no GSI.
 * Written only with `update(...).add(...)`, which creates the row on the day's first scan and
 * stamps the ElectroDB identifiers so `query.primary` still finds it. `scans` and `follows` are
 * optional for that reason: an `update` applies no defaults, so read them as `?? 0`.
 */
export const QrScanDayEntity = new Entity(
  {
    model: {
      entity: 'qr_scan_day',
      version: '1',
      service: 'rasikalife',
    },
    attributes: {
      code: { type: 'string', required: true },
      // yyyy-mm-dd in the app's default zone (DEFAULT_TIMEZONE).
      date: { type: 'string', required: true },
      scans: { type: 'number', required: false },
      follows: { type: 'number', required: false },
    },
    indexes: {
      primary: {
        pk: { field: 'pk', composite: ['code'], template: 'QR#${code}' },
        sk: { field: 'sk', composite: ['date'], template: 'SCAN_DAY#${date}' },
      },
    },
  },
  { client: dynamoClient, table: process.env.DYNAMODB_TABLE || 'RasikaLifeTable' }
);

export type VenueQr = EntityItem<typeof VenueQrEntity>;
export type QrScanDay = EntityItem<typeof QrScanDayEntity>;
