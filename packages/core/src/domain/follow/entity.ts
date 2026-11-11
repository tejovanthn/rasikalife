import { Entity } from 'electrodb';
import type { EntityItem } from 'electrodb';
import { dynamoClient } from '../../db/client';

/**
 * A user follows a venue, an organiser or an artist.
 *
 * pk `USER#${userId}` is the user's own pk, so "who do I follow" is one query. The reverse
 * direction, "who follows this sabha", is gsi1 `byTarget`. Both keys are built from required
 * attributes only (rule 9).
 *
 * Never write this row on its own: `followerCount` on the target moves in the same transaction
 * (see `index.ts`).
 */
export const FollowEntity = new Entity(
  {
    model: {
      entity: 'follow',
      version: '1',
      service: 'rasikalife',
    },
    attributes: {
      userId: { type: 'string', required: true },
      targetType: { type: ['venue', 'organiser', 'artist'] as const, required: true },
      targetId: { type: 'string', required: true },
      // Denormalized; refreshed by the rename cascades.
      targetName: { type: 'string', required: true },
      source: { type: ['qr', 'web'] as const, required: true },
      qrCode: { type: 'string', required: false },
      // The concert they were at when they followed.
      eventId: { type: 'string', required: false },
      // Venue and organiser only. Never pre-ticked.
      shareWithTarget: { type: 'boolean', required: true, default: () => false },
      shareConsentAt: { type: 'string', required: false },
      // Version id of the consent text shown (CONSENT_VERSIONS.share).
      shareConsentVersion: { type: 'string', required: false },
      // Set when sharing goes from true to false, removed when it is granted again. Feeds the
      // sabha dashboard's "Stopped sharing this month" count. Owner decision (phase 8).
      shareWithdrawnAt: { type: 'string', required: false },
      createdAt: {
        type: 'string',
        required: true,
        default: () => new Date().toISOString(),
        readOnly: true,
      },
    },
    indexes: {
      primary: {
        pk: { field: 'pk', composite: ['userId'], template: 'USER#${userId}' },
        sk: {
          field: 'sk',
          composite: ['targetType', 'targetId'],
          template: 'FOLLOW#${targetType}#${targetId}',
        },
      },
      byTarget: {
        index: 'gsi1',
        pk: {
          field: 'gsi1pk',
          composite: ['targetType', 'targetId'],
          template: 'FOLLOWERS#${targetType}#${targetId}',
        },
        sk: {
          field: 'gsi1sk',
          composite: ['createdAt', 'userId'],
          template: '${createdAt}#${userId}',
        },
      },
    },
  },
  { client: dynamoClient, table: process.env.DYNAMODB_TABLE || 'RasikaLifeTable' }
);

export type Follow = EntityItem<typeof FollowEntity>;
