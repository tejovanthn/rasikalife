import { Entity } from 'electrodb';
import type { EntityItem } from 'electrodb';
import { ROLE } from '../../auth/roles';
import { dynamoClient } from '../../db/client';

export const UserEntity = new Entity(
  {
    model: {
      entity: 'user',
      version: '2',
      service: 'rasikalife',
    },
    attributes: {
      id: {
        type: 'string',
        required: true,
      },
      email: {
        type: 'string',
        required: true,
      },
      name: {
        type: 'string',
        required: true,
      },
      picture: {
        type: 'string',
        required: false,
      },
      googleId: {
        type: 'string',
        required: true,
      },
      role: {
        type: 'string',
        enum: Object.values(ROLE),
        required: true,
        default: () => ROLE.EDITOR,
      },
      // Contribution-quality signal: new/established/trusted/curator (orthogonal to role)
      trustLevel: {
        type: 'string',
        enum: ['new', 'established', 'trusted', 'curator'],
        required: false,
        default: () => 'new',
      },
      // User preferences stored as a single map; defaults applied at read time
      preferences: {
        type: 'map',
        properties: {
          theme: { type: 'string', required: false },
          contentLanguage: { type: 'string', required: false },
          contributeToPublicSetlists: { type: 'boolean', required: false },
          attendanceVisible: { type: 'boolean', required: false },
          showProfilePublicly: { type: 'boolean', required: false },
          displayName: { type: 'string', required: false },
          bio: { type: 'string', required: false },
        },
        required: false,
      },
      // URL-safe slug for the public profile (/u/:username).
      // Explicitly set when the user updates their displayName preference.
      // Sparse: only present once the user has set a display name.
      username: {
        type: 'string',
        required: false,
      },
      createdAt: {
        type: 'string',
        required: true,
        default: () => new Date().toISOString(),
        readOnly: true,
      },
      lastSignedInAt: {
        type: 'string',
        required: true,
        default: () => new Date().toISOString(),
        set: () => new Date().toISOString(),
      },
    },
    indexes: {
      primary: {
        pk: {
          field: 'pk',
          composite: ['id'],
          template: 'USER#${id}',
        },
        sk: {
          field: 'sk',
          composite: [],
          template: '#METADATA',
        },
      },
      byEmail: {
        index: 'gsi1',
        pk: {
          field: 'gsi1pk',
          composite: ['email'],
          template: 'USER_EMAIL#${email}',
        },
        sk: {
          field: 'gsi1sk',
          composite: ['id'],
          template: 'USER#${id}',
        },
      },
      byGoogleId: {
        index: 'gsi2',
        pk: {
          field: 'gsi2pk',
          composite: ['googleId'],
          template: 'USER_GOOGLE_ID#${googleId}',
        },
        sk: {
          field: 'gsi2sk',
          composite: ['id'],
          template: 'USER#${id}',
        },
      },
      byUsername: {
        index: 'gsi3',
        pk: {
          field: 'gsi3pk',
          composite: ['username'],
          template: 'USER_USERNAME#${username}',
        },
        sk: {
          field: 'gsi3sk',
          composite: ['id'],
          template: 'USER#${id}',
        },
      },
    },
  },
  { client: dynamoClient, table: process.env.DYNAMODB_TABLE || 'RasikaLifeTable' }
);

export type User = EntityItem<typeof UserEntity>;
