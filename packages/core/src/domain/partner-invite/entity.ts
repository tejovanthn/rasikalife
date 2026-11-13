import { Entity } from 'electrodb';
import type { EntityItem } from 'electrodb';
import { dynamoClient } from '../../db/client';

/**
 * A moderator's invite to a sabha dashboard, keyed by the invited email so it can be found when
 * that person signs in, before any user record is tied to it. No GSI.
 */
export const PartnerInviteEntity = new Entity(
  {
    model: {
      entity: 'partner_invite',
      version: '1',
      service: 'rasikalife',
    },
    attributes: {
      // Always lowercase and trimmed.
      email: {
        type: 'string',
        required: true,
        set: (value?: string) => (value ? value.trim().toLowerCase() : value),
      },
      targetType: { type: ['organiser', 'venue'] as const, required: true },
      targetId: { type: 'string', required: true },
      role: { type: ['owner', 'viewer'] as const, required: true },
      invitedBy: { type: 'string', required: true },
      createdAt: {
        type: 'string',
        required: true,
        default: () => new Date().toISOString(),
      },
      expiresAt: { type: 'string', required: true },
      acceptedAt: { type: 'string', required: false },
    },
    indexes: {
      primary: {
        pk: { field: 'pk', composite: ['email'], template: 'PARTNER_INVITE#${email}' },
        sk: {
          field: 'sk',
          composite: ['targetType', 'targetId'],
          template: '${targetType}#${targetId}',
        },
      },
      // The invites of one target, for the owner's Team tab. Both parts are required (rule 9).
      // Rows written before this index existed have no gsi1 keys; renewing one adds them.
      byTarget: {
        index: 'gsi1',
        pk: {
          field: 'gsi1pk',
          composite: ['targetType', 'targetId'],
          template: 'PARTNER_INVITES#${targetType}#${targetId}',
        },
        sk: { field: 'gsi1sk', composite: ['email'], template: '${email}' },
      },
    },
  },
  { client: dynamoClient, table: process.env.DYNAMODB_TABLE || 'RasikaLifeTable' }
);

export type PartnerInvite = EntityItem<typeof PartnerInviteEntity>;
