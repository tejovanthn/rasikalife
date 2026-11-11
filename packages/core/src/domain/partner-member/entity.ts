import { Entity } from 'electrodb';
import type { EntityItem } from 'electrodb';
import { dynamoClient } from '../../db/client';

/**
 * Grants a user access to a sabha dashboard for one organiser or venue.
 * pk `PARTNER#${targetType}#${targetId}` lists a target's members; gsi1 `byUser` lists the
 * dashboards a user can open. Every key part is a required attribute (rule 9).
 */
export const PartnerMemberEntity = new Entity(
  {
    model: {
      entity: 'partner_member',
      version: '1',
      service: 'rasikalife',
    },
    attributes: {
      userId: { type: 'string', required: true },
      targetType: { type: ['organiser', 'venue'] as const, required: true },
      targetId: { type: 'string', required: true },
      // Denormalized; refreshed by the rename cascades.
      targetName: { type: 'string', required: true },
      role: { type: ['owner', 'viewer'] as const, required: true },
      invitedBy: { type: 'string', required: true },
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
          template: 'PARTNER#${targetType}#${targetId}',
        },
        sk: { field: 'sk', composite: ['userId'], template: 'USER#${userId}' },
      },
      byUser: {
        index: 'gsi1',
        pk: { field: 'gsi1pk', composite: ['userId'], template: 'USER_PARTNERS#${userId}' },
        sk: {
          field: 'gsi1sk',
          composite: ['targetType', 'targetId'],
          template: '${targetType}#${targetId}',
        },
      },
    },
  },
  { client: dynamoClient, table: process.env.DYNAMODB_TABLE || 'RasikaLifeTable' }
);

export type PartnerMember = EntityItem<typeof PartnerMemberEntity>;
