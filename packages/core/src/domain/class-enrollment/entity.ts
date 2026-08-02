import { Entity } from 'electrodb';
import type { EntityItem } from 'electrodb';
import { dynamoClient } from '../../db/client';
import { PROGRAM_TYPES } from '../class-program/schema';
import { ENROLLMENT_STATUSES } from './schema';

/**
 * A learner on a program, and the balance that goes with it.
 *
 * The two indexes are the two questions anyone asks. The primary gives a guru the whole roster
 * of a program in one query; the GSI gives a learner every program they are on in one query.
 * Neither needs a scan and neither needs the other's data.
 *
 * A learner on both a weekly class and a workshop with the same guru has **two independent
 * balances**. That is not a modelling accident to be tidied up later — it is how gurus already
 * think, and the student's home screen shows two cards rather than one merged number.
 *
 * `creditsRemaining` is denormalized and must never be assigned. Every movement is an atomic
 * `ADD`: a signed `classPack` row on the way in, a confirmed session on the way out. The
 * running total is a cache of an append-only ledger, and "why do I have seven credits" has to
 * stay answerable — which it is not the moment anything writes the number directly.
 */
export const ClassEnrollmentEntity = new Entity(
  {
    model: {
      entity: 'classEnrollment',
      version: '1',
      service: 'rasikalife',
    },
    attributes: {
      programId: {
        type: 'string',
        required: true,
      },
      learnerId: {
        type: 'string',
        required: true,
      },
      // Denormalized so an authorisation check does not have to load the program first.
      institutionId: {
        type: 'string',
        required: true,
      },
      learnerName: {
        type: 'string',
        required: true,
      },
      programTitle: {
        type: 'string',
        required: false,
      },
      programType: {
        type: PROGRAM_TYPES,
        required: true,
      },
      creditsRemaining: {
        type: 'number',
        required: true,
        default: 0,
      },
      /**
       * Two denormalized aggregates, for the roster table's "Last class" and "Last paid"
       * columns.
       *
       * The alternative is two queries per learner on a page that lists all of them — a
       * twelve-person workshop would be twenty-four reads to render one table. Both are written
       * where the row they summarise is written, and both are display-only: nothing decides
       * anything from them, so a stale value costs a wrong date on a screen and never a wrong
       * credit.
       *
       * `lastSessionDate` is the marked date, not the confirmed one — the column asks when the
       * class was, and a class awaiting confirmation still happened.
       */
      lastSessionDate: {
        type: 'string',
        required: false,
      },
      lastPaidAt: {
        type: 'string',
        required: false,
      },
      status: {
        type: ENROLLMENT_STATUSES,
        required: true,
        default: 'active',
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
          composite: ['programId'],
          template: 'CLASS_PROGRAM#${programId}',
        },
        sk: {
          field: 'sk',
          composite: ['learnerId'],
          template: 'LEARNER#${learnerId}',
        },
      },
      byLearner: {
        index: 'gsi1',
        pk: {
          field: 'gsi1pk',
          composite: ['learnerId'],
          template: 'CLASS_LEARNER_ENROLLMENTS#${learnerId}',
        },
        sk: {
          field: 'gsi1sk',
          composite: ['programId'],
          template: 'CLASS_PROGRAM#${programId}',
        },
      },
    },
  },
  { client: dynamoClient, table: process.env.DYNAMODB_TABLE || 'RasikaLifeTable' }
);

export type ClassEnrollment = EntityItem<typeof ClassEnrollmentEntity>;
