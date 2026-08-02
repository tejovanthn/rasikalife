import { Entity } from 'electrodb';
import type { EntityItem } from 'electrodb';
import { dynamoClient } from '../../db/client';
import { TEACHER_ROLES } from './schema';

/**
 * Who may teach at an institution. The exact shape of `classLearnerAccess`, for the exact same
 * reason.
 *
 * This replaced a `teacherIds` list attribute on `classInstitution`, which could not answer the
 * question the app now asks on every page load: *which institutions does this user teach at?* A
 * list attribute is not indexable, so that lookup was either a table scan or a lie — the context
 * resolver would have found institutions a user **owns** and silently missed ones they were
 * merely added to, landing a co-teacher on the "do you teach?" screen for ever.
 *
 * Keeping both the list and this junction was the other option and is worse: two sources of
 * truth for who may write to a ledger, drifting the first time one is updated without the other.
 *
 * `institutionName` is denormalized because the context switcher renders it on every page load,
 * and a teacher belongs to one or two institutions — so the alternative is a fan-out of gets on
 * the hottest path in the app. `cascadeInstitutionNameUpdate` is the obligation that buys.
 */
export const ClassTeacherEntity = new Entity(
  {
    model: {
      entity: 'classTeacher',
      version: '1',
      service: 'rasikalife',
    },
    attributes: {
      institutionId: {
        type: 'string',
        required: true,
      },
      userId: {
        type: 'string',
        required: true,
      },
      institutionName: {
        type: 'string',
        required: true,
      },
      // `owner` is not a permission — an owner and a teacher may do exactly the same things
      // today. It exists so the UI can say "your classes" rather than the institution's name,
      // and so ownership transfer has somewhere to land later.
      role: {
        type: TEACHER_ROLES,
        required: true,
        default: 'teacher',
      },
      createdAt: {
        type: 'string',
        required: true,
        default: () => new Date().toISOString(),
        readOnly: true,
      },
    },
    indexes: {
      // Shares the institution partition with programs and learners.
      primary: {
        pk: {
          field: 'pk',
          composite: ['institutionId'],
          template: 'CLASS_INSTITUTION#${institutionId}',
        },
        sk: {
          field: 'sk',
          composite: ['userId'],
          template: 'TEACHER#${userId}',
        },
      },
      // The lookup the whole entity exists for.
      byUser: {
        index: 'gsi1',
        pk: {
          field: 'gsi1pk',
          composite: ['userId'],
          template: 'CLASS_USER_TEACHES#${userId}',
        },
        sk: {
          field: 'gsi1sk',
          composite: ['institutionId'],
          template: 'CLASS_INSTITUTION#${institutionId}',
        },
      },
    },
  },
  { client: dynamoClient, table: process.env.DYNAMODB_TABLE || 'RasikaLifeTable' }
);

export type ClassTeacher = EntityItem<typeof ClassTeacherEntity>;
