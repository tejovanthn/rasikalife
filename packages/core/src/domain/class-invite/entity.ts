import { Entity } from 'electrodb';
import type { EntityItem } from 'electrodb';
import { dynamoClient } from '../../db/client';
import { ACCESS_RELATIONS } from '../class-learner-access/schema';

/**
 * An invitation that sits unclaimed until the invited email signs in.
 *
 * Keyed on the *normalized* email, because that is the only thing the two sides agree on: the
 * guru types `Priya.Raman@gmail.com` and the student signs in as `priyaraman@gmail.com`.
 * `rawEmail` is kept alongside so the guru's roster shows her back what she typed.
 *
 * Claiming runs on **every** sign-in and not just the first. Existing students get invited to
 * new programs later, and a first-sign-in-only check drops those on the floor silently — the
 * student sees the app they already had, with nothing new in it, and nobody has an error to
 * look at.
 */
export const ClassInviteEntity = new Entity(
  {
    model: {
      entity: 'classInvite',
      version: '1',
      service: 'rasikalife',
    },
    attributes: {
      id: {
        type: 'string',
        required: true,
      },
      normalizedEmail: {
        type: 'string',
        required: true,
      },
      rawEmail: {
        type: 'string',
        required: true,
      },
      institutionId: {
        type: 'string',
        required: true,
      },
      programId: {
        type: 'string',
        required: false,
      },
      learnerId: {
        type: 'string',
        required: false,
      },
      learnerName: {
        type: 'string',
        required: false,
      },
      relation: {
        type: ACCESS_RELATIONS,
        required: true,
      },
      invitedBy: {
        type: 'string',
        required: true,
      },
      claimedAt: {
        type: 'string',
        required: false,
      },
      claimedByUserId: {
        type: 'string',
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
          composite: ['normalizedEmail'],
          template: 'CLASS_INVITE#${normalizedEmail}',
        },
        sk: {
          field: 'sk',
          composite: ['id'],
          template: 'INVITE#${id}',
        },
      },
      /**
       * Every invite a guru has sent, so she can see what is outstanding and correct a typo.
       *
       * The primary key is the *recipient's* address, which answers "what is waiting for this
       * person" and nothing else — there was no way to ask "which of my students has not signed
       * in yet" without a table scan.
       *
       * Keyed on `institutionId` and `createdAt`, both required, so no row writes a blank suffix
       * (CLAUDE.md rule 9). Keying it on `learnerId` would have been the obvious choice and is
       * the trap: that attribute is optional — an invite may name a learner *or* carry a name for
       * one that does not exist yet — so every `learnerName` invite on the platform would land in
       * one partition that a blank lookup then matches in full.
       */
      byInstitution: {
        index: 'gsi1',
        pk: {
          field: 'gsi1pk',
          composite: ['institutionId'],
          template: 'CLASS_INVITE_INSTITUTION#${institutionId}',
        },
        sk: {
          field: 'gsi1sk',
          composite: ['createdAt', 'id'],
          template: '${createdAt}#${id}',
        },
      },
    },
  },
  { client: dynamoClient, table: process.env.DYNAMODB_TABLE || 'RasikaLifeTable' }
);

export type ClassInvite = EntityItem<typeof ClassInviteEntity>;
