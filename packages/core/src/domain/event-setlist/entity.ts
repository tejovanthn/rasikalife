import { Entity } from 'electrodb';
import type { EntityItem } from 'electrodb';
import { dynamoClient } from '../../db/client';

export const EVENT_SETLIST_STATUSES = ['derived', 'verified', 'disputed', 'lowConfidence'] as const;
export type EventSetlistStatus = (typeof EVENT_SETLIST_STATUSES)[number];

export const EventSetlistEntity = new Entity(
  {
    model: {
      entity: 'eventSetlist',
      version: '1',
      service: 'rasikalife',
    },
    attributes: {
      eventId: {
        type: 'string',
        required: true,
      },
      order: {
        type: 'number',
        required: true,
      },
      orderStr: {
        type: 'string',
        required: false,
        watch: ['order'],
        set: (_val, attrs) => attrs.order?.toString().padStart(4, '0') ?? '0000',
        default: () => '0000',
      },
      compositionId: {
        type: 'string',
        required: false,
      },
      compositionTitle: {
        type: 'string',
        required: true,
      },
      ragaId: {
        type: 'string',
        required: false,
      },
      ragaName: {
        type: 'string',
        required: false,
      },
      talaId: {
        type: 'string',
        required: false,
      },
      talaName: {
        type: 'string',
        required: false,
      },
      compositionType: {
        type: 'string',
        required: false,
      },
      contributorCount: {
        type: 'number',
        required: true,
        default: () => 1,
      },
      totalLoggersForEvent: {
        type: 'number',
        required: true,
        default: () => 1,
      },
      confidenceScore: {
        type: 'number',
        required: true,
        default: () => 1,
      },
      status: {
        type: 'string',
        enum: [...EVENT_SETLIST_STATUSES] as string[],
        required: true,
        default: () => 'derived',
      },
      // Array of "${userId}#${eventId}#${orderStr}" refs to ConcertLogItems with publicNotes
      publicNoteIds: {
        type: 'list',
        items: { type: 'string' },
        required: false,
        default: () => [],
      },
      // Per-field disagreements: [{field: 'ragaId', options: [{value: '...', count: 2}, ...]}]
      disputes: {
        type: 'list',
        items: {
          type: 'map',
          properties: {
            field: { type: 'string', required: true },
            options: {
              type: 'list',
              items: {
                type: 'map',
                properties: {
                  value: { type: 'string', required: true },
                  count: { type: 'number', required: true },
                },
              },
              required: true,
            },
          },
        },
        required: false,
        default: () => [],
      },
      lastReconciliationAt: {
        type: 'string',
        required: true,
        default: () => new Date().toISOString(),
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
          composite: ['eventId'],
          template: 'EVENT_SETLIST_PUBLIC#${eventId}',
        },
        sk: {
          field: 'sk',
          composite: ['orderStr'],
          template: 'ITEM#${orderStr}',
        },
      },
      byStatus: {
        index: 'gsi1',
        pk: {
          field: 'gsi1pk',
          composite: ['status'],
          template: 'EVENT_SETLIST_STATUS#${status}',
        },
        sk: {
          field: 'gsi1sk',
          composite: ['lastReconciliationAt'],
        },
      },
    },
  },
  { client: dynamoClient, table: process.env.DYNAMODB_TABLE || 'RasikaLifeTable' }
);

export type EventSetlist = EntityItem<typeof EventSetlistEntity>;
