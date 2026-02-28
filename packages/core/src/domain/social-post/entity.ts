import { Entity } from 'electrodb';
import type { EntityItem } from 'electrodb';
import { dynamoClient } from '../../db/client';

export const SocialPostEntity = new Entity(
  {
    model: {
      entity: 'social-post',
      version: '1',
      service: 'rasikalife',
    },
    attributes: {
      platform: {
        type: 'string',
        required: true,
      },
      platformPostId: {
        type: 'string',
        required: true,
      },
      entityType: {
        type: 'string',
        required: true,
      },
      entityId: {
        type: 'string',
        required: true,
      },
      handle: {
        type: 'string',
        required: true,
      },
      postUrl: {
        type: 'string',
        required: true,
      },
      postText: {
        type: 'string',
        required: false,
      },
      mediaUrls: {
        type: 'list',
        items: { type: 'string' },
        required: false,
        default: () => [],
      },
      postedAt: {
        type: 'string',
        required: true,
      },
      processedAt: {
        type: 'string',
        required: false,
      },
      processingStatus: {
        type: 'string',
        required: true,
        default: 'pending',
      },
      extractedEventId: {
        type: 'string',
        required: false,
      },
      errorMessage: {
        type: 'string',
        required: false,
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
          composite: ['platform', 'platformPostId'],
          template: 'SOCIAL_POST#${platform}#${platformPostId}',
        },
        sk: {
          field: 'sk',
          composite: [],
          template: '#METADATA',
        },
      },
      byEntity: {
        index: 'gsi1',
        pk: {
          field: 'gsi1pk',
          composite: ['entityType', 'entityId'],
          template: 'SOCIAL_POST_ENTITY#${entityType}#${entityId}',
        },
        sk: {
          field: 'gsi1sk',
          composite: ['postedAt'],
          template: '${postedAt}',
        },
      },
      byStatus: {
        index: 'gsi2',
        pk: {
          field: 'gsi2pk',
          composite: ['processingStatus'],
          template: 'SOCIAL_POST_STATUS#${processingStatus}',
        },
        sk: {
          field: 'gsi2sk',
          composite: ['postedAt'],
          template: '${postedAt}',
        },
      },
    },
  },
  { client: dynamoClient, table: process.env.DYNAMODB_TABLE || 'RasikaLifeTable' }
);

export type SocialPost = EntityItem<typeof SocialPostEntity>;
