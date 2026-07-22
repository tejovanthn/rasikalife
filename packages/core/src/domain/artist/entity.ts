import { Entity } from 'electrodb';
import type { EntityItem } from 'electrodb';
import { dynamoClient } from '../../db/client';

export const ArtistEntity = new Entity(
  {
    model: {
      entity: 'artist',
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
      title: {
        type: 'string',
        required: false,
      },
      // The three optional keys widen this in place: every existing {id, name}
      // row is already valid under the new shape, so there is no backfill and
      // no window where stored data is invalid.
      gurus: {
        type: 'list',
        items: {
          type: 'map',
          properties: {
            id: { type: 'string', required: false },
            name: { type: 'string', required: true },
            fromYear: { type: 'number', required: false },
            toYear: { type: 'number', required: false },
            discipline: { type: 'string', required: false },
          },
        },
        required: false,
        default: () => [],
      },
      biography: {
        type: 'string',
        required: false,
      },
      specialisations: {
        type: 'list',
        items: { type: 'string' },
        required: false,
      },
      birthYear: {
        type: 'number',
        required: false,
      },
      birthPlace: {
        type: 'string',
        required: false,
      },
      website: {
        type: 'string',
        required: false,
      },
      socialLinks: {
        type: 'list',
        items: {
          type: 'map',
          properties: {
            platform: { type: 'string', required: true },
            url: { type: 'string', required: true },
          },
        },
        required: false,
      },
      activeYears: {
        type: 'string',
        required: false,
      },
      instrument: {
        type: 'string',
        required: false,
      },
      city: {
        type: 'string',
        required: false,
      },
      practiceStartYear: {
        type: 'number',
        required: false,
      },
      debutYear: {
        type: 'number',
        required: false,
      },
      photoUrl: {
        type: 'string',
        required: false,
      },
      photoUploadId: {
        type: 'string',
        required: false,
      },
      // A performing group or duo (Saralaya Sisters, Ganesh Kumaresh) rather
      // than an individual. Membership edges live in the ArtistMembership
      // junction, not here.
      isGroup: {
        type: 'boolean',
        required: false,
      },
      // Denormalized badge state. The authoritative claim rows live in the
      // ArtistClaim entity; this copy exists so the profile renders the badge
      // without a second query. Set by the claim flow, never by a form —
      // which is why neither this nor verifiedAt appears in the Zod schemas.
      claimStatus: {
        type: ['unclaimed', 'pending', 'verified', 'rejected'] as const,
        required: false,
      },
      verifiedAt: {
        type: 'string',
        required: false,
      },
      deletedAt: {
        type: 'string',
        required: false,
      },
      mergedIntoId: {
        type: 'string',
        required: false,
      },
      alternateNames: {
        type: 'list',
        items: {
          type: 'string',
        },
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
          composite: ['id'],
          template: 'ARTIST#${id}',
        },
        sk: {
          field: 'sk',
          composite: [],
          template: '#METADATA',
        },
      },
      byName: {
        index: 'gsi1',
        pk: {
          field: 'gsi1pk',
          composite: ['name'],
          template: 'ARTIST_NAME#${name}',
        },
        sk: {
          field: 'gsi1sk',
          composite: ['id'],
          template: 'ARTIST#${id}',
        },
      },
      list: {
        index: 'gsi2',
        pk: {
          field: 'gsi2pk',
          composite: [],
          template: 'ARTIST_LIST',
        },
        sk: {
          field: 'gsi2sk',
          composite: ['name', 'id'],
          template: '${name}#${id}',
        },
      },
    },
  },
  { client: dynamoClient, table: process.env.DYNAMODB_TABLE || 'RasikaLifeTable' }
);

export type Artist = EntityItem<typeof ArtistEntity>;

// Artist names are NOT stored in ITRANS. They are romanised Latin, and
// decoding them as ITRANS corrupts them — see the name-display fix in
// docs/plans/260722-01-artist-profile-redesign.md (4.1). The raga, tala and
// composition entities keep their own ItransText alias because the terms
// those hold genuinely are ITRANS.
