import { Entity } from 'electrodb';
import type { EntityItem } from 'electrodb';
import { dynamoClient } from '../../db/client';
import { CLASS_MODES, PROGRAM_TYPES } from '../class-program/schema';
import { SESSION_STATUSES } from './schema';

/**
 * One row per learner per class. A group class fans out to one row each.
 *
 * Fanning out on write is what keeps every read simple. A student's history is one query on
 * one partition and looks identical whether the class was a 1:1 or a workshop of two hundred;
 * credits decrement per learner with no branching; and a learner who skipped a group class is
 * one row marked `absent` rather than an exception list hanging off a shared record.
 *
 * ## The two dates
 *
 * `sessionDate` is `YYYY-MM-DD` in the **teacher's** zone and it is the ledger key. `startsAt`
 * is the full instant, and it is what each viewer's browser renders in their own zone. Storing
 * only the instant does not fix the cross-timezone off-by-one, it relocates it to a third zone
 * that is wrong for both parties: an 8am Chennai class is 02:30Z, which the student in New
 * York experienced the previous evening. So the student sees "Mon 8:30pm your time", the guru
 * sees "Tue 7am", it is one row, and the sort key never shifts under either of them.
 *
 * ## The indexes, and why none of them is sparse
 *
 * ElectroDB writes a GSI key for every row whose composites resolve, and a *missing* composite
 * writes the template with an empty suffix rather than omitting the key (CLAUDE.md rule 9).
 * There is therefore no such thing as a "pending-only" index here, and pretending otherwise
 * would produce one hot partition plus a lookup that matches everything. Every composite below
 * is a required attribute, and `status` is part of two of them so the queries that care about
 * pending rows read *only* pending rows:
 *
 *   - `byInstitutionStatus` — the guru's review queue, exact and date-ordered.
 *   - `byGroup` — the rows of one group class, for collapsing them into a single queue row.
 *   - `byDue` — the auto-confirm cron, which needs every overdue pending session across all
 *     institutions and cannot enumerate institutions to get there.
 *
 * `byDue` is partitioned on `status` alone, and that is a scale trade taken deliberately rather
 * than an oversight. Only `class_session_due#pending` is ever read, but all four partitions are
 * *written*: every confirmation moves a row into `class_session_due#confirmed`, which grows
 * without bound and nothing queries. At one guru it is nothing. The ceiling is the pending
 * partition, which takes every mark on the platform and caps around 1000 WCU — comfortable into
 * the thousands of gurus. **Trigger to revisit: sustained write throttling on gsi3, or GSI
 * storage becoming visible on the bill.** The fix is to bucket the key by day
 * (`#${status}#${autoConfirmAt.slice(0, 10)}`) and have the cron sweep the last N buckets, which
 * keeps its access pattern and drops the three dead partitions.
 *
 * `groupSessionId` is required and defaults to the session's own id, which makes a solo class
 * a group of one. That is not a trick to satisfy the index: it means fan-out and solo are the
 * same code path, and the review queue's grouping logic has no special case.
 */
export const ClassSessionEntity = new Entity(
  {
    model: {
      entity: 'classSession',
      version: '1',
      service: 'rasikalife',
    },
    attributes: {
      id: {
        type: 'string',
        required: true,
      },
      programId: {
        type: 'string',
        required: true,
      },
      learnerId: {
        type: 'string',
        required: true,
      },
      institutionId: {
        type: 'string',
        required: true,
      },
      sessionDate: {
        type: 'string',
        required: true,
      },
      startsAt: {
        type: 'string',
        required: false,
      },
      timezone: {
        type: 'string',
        required: true,
        default: 'Asia/Kolkata',
      },
      status: {
        type: SESSION_STATUSES,
        required: true,
        default: 'pending',
      },
      mode: {
        type: CLASS_MODES,
        required: true,
      },
      teacherId: {
        type: 'string',
        required: false,
      },
      groupSessionId: {
        type: 'string',
        required: true,
      },
      notes: {
        type: 'string',
        required: false,
      },
      // Reserved. No UI in the MVP, and that is a decision rather than a gap: the sentence
      // worth writing is "you have not touched Nagumomu since April", and that needs one guru
      // with months of history, not a picker shipped early against thin data.
      compositionIds: {
        type: 'list',
        items: { type: 'string' },
        required: false,
        default: () => [],
      },
      programTitle: {
        type: 'string',
        required: false,
      },
      programType: {
        type: PROGRAM_TYPES,
        required: true,
      },
      markedBy: {
        type: 'string',
        required: false,
      },
      // A user id, or the literal 'system' when the cron confirmed it.
      confirmedBy: {
        type: 'string',
        required: false,
      },
      autoConfirmAt: {
        type: 'string',
        required: true,
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
      // Shares a partition with classPack: one query reads a learner's whole ledger.
      primary: {
        pk: {
          field: 'pk',
          composite: ['programId', 'learnerId'],
          template: 'CLASS_ENROLLMENT#${programId}#${learnerId}',
        },
        sk: {
          field: 'sk',
          composite: ['sessionDate', 'id'],
          template: 'SESSION#${sessionDate}#${id}',
        },
      },
      byInstitutionStatus: {
        index: 'gsi1',
        pk: {
          field: 'gsi1pk',
          composite: ['institutionId', 'status'],
          template: 'CLASS_SESSION#${institutionId}#${status}',
        },
        sk: {
          field: 'gsi1sk',
          composite: ['sessionDate', 'id'],
          template: '${sessionDate}#${id}',
        },
      },
      byGroup: {
        index: 'gsi2',
        pk: {
          field: 'gsi2pk',
          composite: ['groupSessionId'],
          template: 'CLASS_GROUP_SESSION#${groupSessionId}',
        },
        sk: {
          field: 'gsi2sk',
          composite: ['learnerId'],
          template: 'LEARNER#${learnerId}',
        },
      },
      byDue: {
        index: 'gsi3',
        pk: {
          field: 'gsi3pk',
          composite: ['status'],
          template: 'CLASS_SESSION_DUE#${status}',
        },
        sk: {
          field: 'gsi3sk',
          composite: ['autoConfirmAt', 'id'],
          template: '${autoConfirmAt}#${id}',
        },
      },
    },
  },
  { client: dynamoClient, table: process.env.DYNAMODB_TABLE || 'RasikaLifeTable' }
);

export type ClassSession = EntityItem<typeof ClassSessionEntity>;
