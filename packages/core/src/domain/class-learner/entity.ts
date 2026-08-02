import { Entity } from 'electrodb';
import type { EntityItem } from 'electrodb';
import { dynamoClient } from '../../db/client';

/**
 * The person being taught. Deliberately not a user account.
 *
 * A meaningful share of students are children with no email of their own, and one parent
 * commonly manages two or three of them. Making a learner an account would force either a
 * shared login or an email address invented for a child, and both are worse than the shape
 * here: a learner is a record, and `classLearnerAccess` says which Google accounts may see it.
 *
 * The attribute list is short on purpose and must stay that way. No date of birth, no photo,
 * no address, no phone, no free-text notes. `isMinor` is a policy flag the guru sets — it
 * decides whether the last guardian can be removed — and never a verified fact, which is why
 * no birthday is collected to derive it from. India's DPDP Act treats under-18 data as needing
 * verifiable parental consent, and the cheapest way to stay clear of that is to hold nothing.
 *
 * `lastInitial` rather than a surname for the same reason: a roster needs to tell two Priyas
 * apart, and that is all it needs.
 */
export const ClassLearnerEntity = new Entity(
  {
    model: {
      entity: 'classLearner',
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
      firstName: {
        type: 'string',
        required: true,
      },
      lastInitial: {
        type: 'string',
        required: false,
      },
      isMinor: {
        type: 'boolean',
        required: true,
        default: false,
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
      // Shares a partition with classProgram — same pk, different sort key prefix — so a
      // guru's whole roster sits together. ElectroDB scopes each query by the sk template and
      // by its own entity marker, so neither entity ever reads the other's rows.
      primary: {
        pk: {
          field: 'pk',
          composite: ['institutionId'],
          template: 'CLASS_INSTITUTION#${institutionId}',
        },
        sk: {
          field: 'sk',
          composite: ['id'],
          template: 'LEARNER#${id}',
        },
      },
      byId: {
        index: 'gsi1',
        pk: {
          field: 'gsi1pk',
          composite: ['id'],
          template: 'CLASS_LEARNER#${id}',
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

export type ClassLearner = EntityItem<typeof ClassLearnerEntity>;
