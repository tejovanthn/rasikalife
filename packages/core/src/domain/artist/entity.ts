import { Entity } from 'electrodb';
import type { EntityItem } from 'electrodb';
import { dynamoClient } from '../../db/client';
import { ARTIST_CLAIM_STATUSES } from './schema';

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
      /**
       * Keep this record out of the artist index and the search corpus.
       *
       * A photographer credited on a gallery photo is an Artist record — reusing the entity
       * gets find-or-create through the shared dedup helper and the byName GSI for free,
       * where a separate Photographer entity would have needed both again. But a photographer
       * is not someone a rasika browses for, so `listArtists` filters these out, and because
       * the search indexer reads that same function they leave the search index too.
       *
       * A flag rather than matching on `specialisations` containing "photography": a
       * visibility rule keyed off free text is the kind that silently stops working when
       * someone types "Photography" or "photographer".
       *
       * Nothing stops an unlisted record being promoted later — a photographer who turns out
       * to perform is the same person, and a moderator clears the flag.
       */
      unlisted: {
        type: 'boolean',
        required: false,
      },
      // Denormalized badge state. The authoritative claim rows live in the
      // ArtistClaim entity; this copy exists so the profile renders the badge
      // without a second query. Set by the claim flow, never by a form —
      // which is why neither this nor verifiedAt appears in the Zod schemas.
      claimStatus: {
        type: ARTIST_CLAIM_STATUSES,
        required: false,
      },
      verifiedAt: {
        type: 'string',
        required: false,
      },
      // Derived from shared events, never edited by hand. Denormalized onto the artist so
      // the profile renders the collaborator grid without a fan-out query, the same
      // write-at-mutation-time trade the rsvpCount counters make.
      collaborators: {
        type: 'list',
        items: {
          type: 'map',
          properties: {
            artistId: { type: 'string', required: true },
            name: { type: 'string', required: true },
            sharedEventCount: { type: 'number', required: true },
            lastSharedAt: { type: 'string', required: true },
            topRoles: { type: 'list', items: { type: 'string' }, required: false },
            strength: { type: 'number', required: true },
          },
        },
        required: false,
      },
      collaboratorsComputedAt: {
        type: 'string',
        required: false,
      },
      // Denormalized "most performed" repertoire, derived from the setlists of the
      // artist's events. Stored so the profile reads one field instead of a per-view
      // fan-out over every event's setlist. Refreshed by the rebuild-repertoire sweep,
      // not inline — the read is hot, the aggregate tolerates staleness, and recomputing
      // it inline on every concert-log submit would amplify that frequent write badly.
      topCompositions: {
        type: 'list',
        items: {
          type: 'map',
          properties: {
            id: { type: 'string', required: true },
            title: { type: 'string', required: true },
            count: { type: 'number', required: true },
          },
        },
        required: false,
      },
      topRagas: {
        type: 'list',
        items: {
          type: 'map',
          properties: {
            id: { type: 'string', required: true },
            name: { type: 'string', required: true },
            count: { type: 'number', required: true },
          },
        },
        required: false,
      },
      repertoireComputedAt: {
        type: 'string',
        required: false,
      },
      // Denormalized moderator-curated "notable performances" for the profile teaser,
      // maintained by setEventArtistFeatured. Stored so the teaser reads one field
      // instead of a filtered full-partition scan of the artist's EventArtist rows.
      // The list is tiny (a moderator curates a handful), so the display copies of
      // eventTitle/eventStartDateTime can lag an event rename until it is re-featured —
      // cosmetic, and there is no reverse index to refresh them cheaply.
      featuredPerformances: {
        type: 'list',
        items: {
          type: 'map',
          properties: {
            eventId: { type: 'string', required: true },
            eventTitle: { type: 'string', required: true },
            eventStartDateTime: { type: 'string', required: true },
            role: { type: 'string', required: false },
            featureRank: { type: 'number', required: false },
          },
        },
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
