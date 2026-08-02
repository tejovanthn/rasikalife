import { Entity } from 'electrodb';
import type { EntityItem } from 'electrodb';
import { dynamoClient } from '../../db/client';

/**
 * Credit grants and corrections. Immutable and append-only.
 *
 * `classEnrollment.creditsRemaining` is the running sum of these rows minus the sessions that
 * consumed a credit. Nothing edits a row here and nothing assigns that total — a correction is
 * a *new* row with a negative delta and a reason. This is the same argument the
 * `change_history` entity makes: once money is involved the audit trail is the product, and
 * "why do I have seven credits" must always be answerable by reading rows rather than by
 * trusting a number.
 *
 * Two operations look alike and are not:
 *
 *   - Changing the guru's standard pack size edits `defaultPackSize` on the *program*. Future
 *     packs only, nothing retroactive.
 *   - Correcting a balance writes a row here. Never an edit, never a direct write.
 *
 * `screenshotKey` is a private S3 key, never a URL. Payment screenshots are people's UPI
 * transaction records and must not go near the public image pipeline, which writes to a bucket
 * behind a public CDN. `amount` and `currency` exist and are never collected in the MVP: the
 * platform does not move money, and a screenshot plus the guru tapping "received" is the whole
 * payment surface.
 */
export const ClassPackEntity = new Entity(
  {
    model: {
      entity: 'classPack',
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
      // Signed. +8 for a pack, +1 for a goodwill class, -2 for a correction.
      delta: {
        type: 'number',
        required: true,
      },
      reason: {
        type: 'string',
        required: false,
      },
      screenshotKey: {
        type: 'string',
        required: false,
      },
      amount: {
        type: 'number',
        required: false,
      },
      currency: {
        type: 'string',
        required: false,
      },
      grantedBy: {
        type: 'string',
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
      // Shares a partition with classSession, so one query per learner reads their whole
      // ledger — the packs that put credits in and the sessions that took them out.
      primary: {
        pk: {
          field: 'pk',
          composite: ['programId', 'learnerId'],
          template: 'CLASS_ENROLLMENT#${programId}#${learnerId}',
        },
        sk: {
          field: 'sk',
          composite: ['createdAt', 'id'],
          template: 'PACK#${createdAt}#${id}',
        },
      },
    },
  },
  { client: dynamoClient, table: process.env.DYNAMODB_TABLE || 'RasikaLifeTable' }
);

export type ClassPack = EntityItem<typeof ClassPackEntity>;
