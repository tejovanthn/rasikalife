import { Entity } from 'electrodb';
import type { EntityItem } from 'electrodb';
import { dynamoClient } from '../../db/client';

/**
 * Who owns a set of class programs, and therefore who owns the credit ledger.
 *
 * A solo guru is auto-provisioned one on first use and is never shown the word "institution"
 * anywhere in the UI. The entity exists anyway, and not as future-proofing: the credit ledger
 * has to survive a substitute teacher. If credits belonged to a guru, every class taught by a
 * stand-in would either be free or need a second ledger. So credits belong here, and
 * `classSession.teacherId` records who actually took the class.
 *
 * Who may teach here lives in the `classTeacher` junction, not in a list attribute on this row.
 * A list cannot be indexed, and the context resolver has to answer "which institutions does this
 * user teach at" on every page load — see that entity for the whole argument.
 *
 * `timezone` is the guru's zone and it is the source of every `sessionDate`. It lives here
 * rather than on the program because a session's date has to be decided before the session
 * row exists: a student in California pressing "mark today" is marking the teacher's tomorrow.
 */
export const ClassInstitutionEntity = new Entity(
  {
    model: {
      entity: 'classInstitution',
      version: '1',
      service: 'rasikalife',
    },
    attributes: {
      id: {
        type: 'string',
        required: true,
      },
      name: {
        type: 'string',
        required: true,
      },
      ownerUserId: {
        type: 'string',
        required: true,
      },
      timezone: {
        type: 'string',
        required: true,
        default: 'Asia/Kolkata',
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
          composite: ['id'],
          template: 'CLASS_INSTITUTION#${id}',
        },
        sk: {
          field: 'sk',
          composite: [],
          template: '#METADATA',
        },
      },
      // Both composites are required attributes, so no row writes a blank suffix here. See
      // CLAUDE.md rule 9 for what that costs when it happens.
      byOwner: {
        index: 'gsi1',
        pk: {
          field: 'gsi1pk',
          composite: ['ownerUserId'],
          template: 'CLASS_INSTITUTION_OWNER#${ownerUserId}',
        },
        sk: {
          field: 'gsi1sk',
          composite: ['id'],
          template: 'CLASS_INSTITUTION#${id}',
        },
      },
    },
  },
  { client: dynamoClient, table: process.env.DYNAMODB_TABLE || 'RasikaLifeTable' }
);

export type ClassInstitution = EntityItem<typeof ClassInstitutionEntity>;
