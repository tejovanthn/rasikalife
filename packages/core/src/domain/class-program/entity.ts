import { Entity } from 'electrodb';
import type { EntityItem } from 'electrodb';
import { dynamoClient } from '../../db/client';
import { CLASS_MODES, PROGRAM_TYPES, SKIP_POLICIES } from './schema';

/**
 * A guru's offering.
 *
 * A regular weekly 1:1 class is a program with no title and one enrollment. A workshop is a
 * program with a title and many. There is no structural difference beyond that, and inventing
 * one would mean two of everything downstream — two ledgers, two review queues, two ways for a
 * session to be marked.
 *
 * This is emphatically *not* the `Event` entity. Events are public, moderated and
 * wiki-editable; a class program is private to its roster. Overloading `Event` would drag a
 * child's attendance record into the public moderation queue.
 *
 * `nominalCount` is the "supposed to be ten" and is reference only — never a constraint. A
 * workshop sold as ten classes routinely runs to thirteen, and a tool that stops the guru
 * marking the eleventh is a tool she stops opening. See `creditsRemaining` on the enrollment,
 * which is allowed to go negative for the same reason.
 */
export const ClassProgramEntity = new Entity(
  {
    model: {
      entity: 'classProgram',
      version: '1',
      service: 'rasikalife',
    },
    attributes: {
      id: {
        type: 'string',
        required: true,
      },
      institutionId: {
        type: 'string',
        required: true,
      },
      type: {
        type: PROGRAM_TYPES,
        required: true,
        default: 'regular',
      },
      // Absent on a regular program. The UI renders "Weekly class" rather than storing that
      // string, so a guru who never names anything never sees a field she has to fill in.
      title: {
        type: 'string',
        required: false,
      },
      agenda: {
        type: 'string',
        required: false,
      },
      isGroup: {
        type: 'boolean',
        required: true,
        default: false,
      },
      defaultMode: {
        type: CLASS_MODES,
        required: true,
        default: 'in-person',
      },
      defaultTeacherId: {
        type: 'string',
        required: false,
      },
      nominalCount: {
        type: 'number',
        required: false,
      },
      // Future packs only. Changing this is not a correction to anyone's balance — that is a
      // signed `classPack` row, and conflating the two is the mistake this comment exists for.
      defaultPackSize: {
        type: 'number',
        required: false,
      },
      skipPolicy: {
        type: SKIP_POLICIES,
        required: true,
        default: 'burn',
      },
      // Reserved for the day a guru wants a workshop filled publicly. Unused in the MVP, and
      // deliberately inert: nothing reads it, so nothing leaks a private roster.
      publicEventId: {
        type: 'string',
        required: false,
      },
      archivedAt: {
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
          composite: ['institutionId'],
          template: 'CLASS_INSTITUTION#${institutionId}',
        },
        sk: {
          field: 'sk',
          composite: ['createdAt', 'id'],
          template: 'PROGRAM#${createdAt}#${id}',
        },
      },
      byId: {
        index: 'gsi1',
        pk: {
          field: 'gsi1pk',
          composite: ['id'],
          template: 'CLASS_PROGRAM#${id}',
        },
        sk: {
          field: 'gsi1sk',
          composite: [],
          template: '#METADATA',
        },
      },
    },
  },
  { client: dynamoClient, table: process.env.DYNAMODB_TABLE || 'RasikaLifeTable' }
);

export type ClassProgram = EntityItem<typeof ClassProgramEntity>;
