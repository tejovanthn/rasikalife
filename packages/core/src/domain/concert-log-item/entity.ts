import { Entity } from 'electrodb';
import type { EntityItem } from 'electrodb';
import { dynamoClient } from '../../db/client';

export const COMPOSITION_TYPES = [
  'varnam',
  'kriti',
  'rtp',
  'thillana',
  'javali',
  'padam',
  'viruttam',
  'thukkada',
  'slokam',
  'tani',
  'other',
] as const;

export type CompositionType = (typeof COMPOSITION_TYPES)[number];

export const ConcertLogItemEntity = new Entity(
  {
    model: {
      entity: 'concertLogItem',
      version: '1',
      service: 'rasikalife',
    },
    attributes: {
      userId: {
        type: 'string',
        required: true,
      },
      eventId: {
        type: 'string',
        required: true,
      },
      order: {
        type: 'number',
        required: true,
      },
      // Zero-padded order string for lexicographic sorting in GSI keys
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
      publicNote: {
        type: 'string',
        required: false,
      },
      isHighlight: {
        type: 'boolean',
        required: false,
        default: () => false,
      },
      eventStartDateTime: {
        type: 'string',
        required: true,
      },
      moderatorReviewedAt: {
        type: 'string',
        required: false,
      },
      moderatorRejectedReason: {
        type: 'string',
        required: false,
      },
      moderatorId: {
        type: 'string',
        required: false,
      },
      // Fully computed GSI pk for byComposition — undefined when compositionId is absent (sparse GSI)
      compositionPerfKey: {
        type: 'string',
        required: false,
        watch: ['compositionId'],
        set: (_val, attrs) =>
          attrs.compositionId ? `COMPOSITION_PERFORMANCES#${attrs.compositionId}` : undefined,
      },
      // Fully computed GSI pk for byRaga — undefined when ragaId is absent (sparse GSI)
      ragaPerfKey: {
        type: 'string',
        required: false,
        watch: ['ragaId'],
        set: (_val, attrs) => (attrs.ragaId ? `RAGA_PERFORMANCES#${attrs.ragaId}` : undefined),
      },
      // Computed: '1' when compositionId is absent AND no moderator review yet
      // Used as GSI4 partition key — undefined value means item is excluded from GSI4
      pendingModerationKey: {
        type: 'string',
        required: false,
        watch: ['compositionId', 'moderatorReviewedAt'],
        set: (_val, attrs) => {
          if (!attrs.compositionId && !attrs.moderatorReviewedAt) return '1';
          return undefined;
        },
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
          composite: ['userId', 'eventId'],
          template: 'CONCERT_LOG_ITEMS#${userId}#${eventId}',
        },
        sk: {
          field: 'sk',
          composite: ['orderStr'],
          template: 'ITEM#${orderStr}',
        },
      },
      byEvent: {
        index: 'gsi1',
        pk: {
          field: 'gsi1pk',
          composite: ['eventId'],
          template: 'EVENT_SETLIST#${eventId}',
        },
        sk: {
          field: 'gsi1sk',
          composite: ['orderStr', 'userId'],
          template: '${orderStr}#${userId}',
        },
      },
      byComposition: {
        index: 'gsi2',
        pk: {
          field: 'gsi2pk',
          casing: 'none',
          // compositionPerfKey is undefined when compositionId is absent → sparse GSI (item not indexed)
          composite: ['compositionPerfKey'],
          template: '${compositionPerfKey}',
        },
        sk: {
          field: 'gsi2sk',
          composite: ['eventStartDateTime', 'userId', 'eventId'],
          template: '${eventStartDateTime}#${userId}#${eventId}',
        },
      },
      byRaga: {
        index: 'gsi3',
        pk: {
          field: 'gsi3pk',
          casing: 'none',
          // ragaPerfKey is undefined when ragaId is absent → sparse GSI (item not indexed)
          composite: ['ragaPerfKey'],
          template: '${ragaPerfKey}',
        },
        sk: {
          field: 'gsi3sk',
          composite: ['eventStartDateTime', 'userId', 'eventId'],
          template: '${eventStartDateTime}#${userId}#${eventId}',
        },
      },
      byPendingModeration: {
        index: 'gsi4',
        pk: {
          field: 'gsi4pk',
          composite: ['pendingModerationKey'],
          template: 'SETLIST_PENDING#${pendingModerationKey}',
        },
        sk: {
          field: 'gsi4sk',
          composite: ['createdAt', 'userId', 'eventId', 'orderStr'],
          template: '${createdAt}#${userId}#${eventId}#${orderStr}',
        },
      },
    },
  },
  { client: dynamoClient, table: process.env.DYNAMODB_TABLE || 'RasikaLifeTable' }
);

export type ConcertLogItem = EntityItem<typeof ConcertLogItemEntity>;
