import { Entity } from 'electrodb';
import type { EntityItem } from 'electrodb';
import { dynamoClient } from '../../db/client';

export const ArtistMembershipEntity = new Entity(
  {
    model: {
      entity: 'artistMembership',
      version: '1',
      service: 'rasikalife',
    },
    attributes: {
      groupId: {
        type: 'string',
        required: true,
      },
      groupName: {
        type: 'string',
        required: true,
      },
      memberId: {
        type: 'string',
        required: true,
      },
      memberName: {
        type: 'string',
        required: true,
      },
      role: {
        type: 'string',
        required: false,
      },
      rank: {
        type: 'number',
        required: false,
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
          composite: ['groupId'],
          template: 'GROUP#${groupId}',
        },
        sk: {
          field: 'sk',
          composite: ['memberId'],
          template: 'MEMBER#${memberId}',
        },
      },
      byMember: {
        index: 'gsi1',
        pk: {
          field: 'gsi1pk',
          composite: ['memberId'],
          template: 'MEMBER#${memberId}',
        },
        sk: {
          field: 'gsi1sk',
          composite: ['groupId'],
          template: 'GROUP#${groupId}',
        },
      },
    },
  },
  { client: dynamoClient, table: process.env.DYNAMODB_TABLE || 'RasikaLifeTable' }
);

export type ArtistMembership = EntityItem<typeof ArtistMembershipEntity>;
