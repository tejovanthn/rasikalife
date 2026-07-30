import { Entity } from 'electrodb';
import type { EntityItem } from 'electrodb';
import { dynamoClient } from '../../db/client';
import { CLAIM_SOURCES } from '../artist/schema';

/**
 * An artist's institutional role: founder, artistic director, faculty.
 *
 * A junction rather than a list attribute on Artist, because the reverse direction is the
 * point. "Which artists are on this school's faculty" is a question no list attribute can
 * answer without scanning the table, and it is what turns an Organiser page from a stub into
 * something worth linking to. Contrast `artist.credentials`, which stays a list precisely
 * because nobody wants the reverse listing.
 *
 * `organiserId` is REQUIRED, and that is a design constraint, not an oversight. An index over
 * an optional attribute is not sparse: a missing composite writes the template with an empty
 * suffix, producing one hot partition, and on a lookup a blank argument then matches
 * everything. So an affiliation exists only once its organisation resolves to an Organiser
 * record — an unresolved organisation name is not yet an affiliation, and stays in the
 * extraction CSV until a human picks or creates the right one.
 *
 * `artistName` and `organisationName` are denormalized so each side lists the other without a
 * fan-out, which is what obliges the four cascade functions (artist and organiser, rename and
 * merge) to carry this entity.
 */
export const ArtistAffiliationEntity = new Entity(
  {
    model: {
      entity: 'artistAffiliation',
      version: '1',
      service: 'rasikalife',
    },
    attributes: {
      artistId: {
        type: 'string',
        required: true,
      },
      artistName: {
        type: 'string',
        required: true,
      },
      organiserId: {
        type: 'string',
        required: true,
      },
      organisationName: {
        type: 'string',
        required: true,
      },
      // Free text, not an enum: "founder, artistic director" and "adjunct faculty, Western
      // classical dance" are both real and neither survives a closed set.
      role: {
        type: 'string',
        required: false,
      },
      discipline: {
        type: 'string',
        required: false,
      },
      startYear: {
        type: 'number',
        required: false,
      },
      endYear: {
        type: 'number',
        required: false,
      },
      // Held separately from `endYear` rather than derived from it: "currently faculty at IIM
      // Bangalore, started sometime" is the common shape, so a blank endYear cannot be read as
      // either current or ended.
      isCurrent: {
        type: 'boolean',
        required: false,
      },
      source: {
        type: CLAIM_SOURCES,
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
      // Artist-first, mirroring ArtistAward: the profile is the hot read, so it gets the
      // primary index and the far rarer organiser page reads the GSI.
      primary: {
        pk: {
          field: 'pk',
          composite: ['artistId'],
          template: 'ARTIST#${artistId}',
        },
        sk: {
          field: 'sk',
          composite: ['organiserId'],
          template: 'ORGANISER#${organiserId}',
        },
      },
      byOrganiser: {
        index: 'gsi1',
        pk: {
          field: 'gsi1pk',
          composite: ['organiserId'],
          template: 'ORGANISER#${organiserId}',
        },
        sk: {
          field: 'gsi1sk',
          composite: ['artistId'],
          template: 'ARTIST#${artistId}',
        },
      },
    },
  },
  { client: dynamoClient, table: process.env.DYNAMODB_TABLE || 'RasikaLifeTable' }
);

export type ArtistAffiliation = EntityItem<typeof ArtistAffiliationEntity>;
