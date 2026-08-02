import { Entity } from 'electrodb';
import type { EntityItem } from 'electrodb';
import { dynamoClient } from '../../db/client';
import { ACCESS_RELATIONS } from './schema';

/**
 * Which Google accounts may see a learner.
 *
 * One sign-in resolves through `byUser` to every learner it can see. A parent with two
 * children gets two rows and a profile switcher; an adult student gets one `self` row and
 * never sees a switcher at all.
 *
 * The reason this is a junction and not a `guardianUserId` field on the learner is the young
 * adult case. A sixteen year old with their own Gmail gets a *second* row, `relation: 'self'`,
 * while the guardian keeps theirs. Both see the same learner, the same sessions and the same
 * balance. Nothing is migrated and nothing is duplicated — which is what stops the transition
 * from being a data migration that someone has to remember to run.
 */
export const ClassLearnerAccessEntity = new Entity(
  {
    model: {
      entity: 'classLearnerAccess',
      version: '1',
      service: 'rasikalife',
    },
    attributes: {
      learnerId: {
        type: 'string',
        required: true,
      },
      userId: {
        type: 'string',
        required: true,
      },
      relation: {
        type: ACCESS_RELATIONS,
        required: true,
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
          composite: ['learnerId'],
          template: 'CLASS_LEARNER#${learnerId}',
        },
        sk: {
          field: 'sk',
          composite: ['userId'],
          template: 'USER#${userId}',
        },
      },
      byUser: {
        index: 'gsi1',
        pk: {
          field: 'gsi1pk',
          composite: ['userId'],
          template: 'CLASS_USER_LEARNERS#${userId}',
        },
        sk: {
          field: 'gsi1sk',
          composite: ['learnerId'],
          template: 'CLASS_LEARNER#${learnerId}',
        },
      },
    },
  },
  { client: dynamoClient, table: process.env.DYNAMODB_TABLE || 'RasikaLifeTable' }
);

export type ClassLearnerAccess = EntityItem<typeof ClassLearnerAccessEntity>;
