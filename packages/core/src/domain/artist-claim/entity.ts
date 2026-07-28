import { Entity } from 'electrodb';
import type { EntityItem } from 'electrodb';
import { dynamoClient } from '../../db/client';
import { ARTIST_CLAIM_KINDS, ARTIST_CLAIM_STATUSES } from './schema';

export const ArtistClaimEntity = new Entity(
  {
    model: {
      entity: 'artistClaim',
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
      // Discriminates the two row shapes sharing this entity (§4.3.1): a real claim
      // (subject = userId) and a moderator email pre-authorization (subject =
      // normalized email). Both live under the same ARTIST#${artistId} partition, so
      // getArtistClaims(artistId) answers "every claim and invite for this artist" in
      // one query.
      kind: {
        type: ARTIST_CLAIM_KINDS,
        required: true,
      },
      // Copy of userId (kind 'claim') or the normalized email (kind 'invite'), used
      // only to build the sort key so one template serves both row kinds. ElectroDB
      // lowercases the derived sk *string*, not this attribute's own stored value —
      // but never derive an id by parsing sk back apart regardless; read userId/email
      // below instead, which is exactly why they exist as their own attributes.
      subject: {
        type: 'string',
        required: true,
      },
      userId: {
        type: 'string',
        required: false,
      },
      userName: {
        type: 'string',
        required: false,
      },
      // Contact email captured with a self-serve claim. Display/audit only — unlike
      // `email` below, it is never used as an authorization key, so it is never
      // normalized.
      userEmail: {
        type: 'string',
        required: false,
      },
      // Normalized (lowercase + trim) invite email. Present only on 'invite' rows —
      // this is what the byEmail GSI keys off, so a 'claim' row never appears there.
      email: {
        type: 'string',
        required: false,
      },
      status: {
        type: ARTIST_CLAIM_STATUSES,
        required: true,
      },
      note: {
        type: 'string',
        required: false,
      },
      moderatorId: {
        type: 'string',
        required: false,
      },
      moderatorNote: {
        type: 'string',
        required: false,
      },
      createdAt: {
        type: 'string',
        required: true,
        default: () => new Date().toISOString(),
        readOnly: true,
      },
      processedAt: {
        type: 'string',
        required: false,
      },
    },
    indexes: {
      primary: {
        pk: {
          field: 'pk',
          composite: ['artistId'],
          template: 'ARTIST#${artistId}',
        },
        sk: {
          field: 'sk',
          composite: ['kind', 'subject'],
          template: '${kind}#${subject}',
        },
      },
      // The pending moderation queue (getPendingClaims). Mirrors Edit.byStatus /
      // Event.byStatus so a queue can be answered without a scan.
      byStatus: {
        index: 'gsi1',
        pk: {
          field: 'gsi1pk',
          composite: ['status'],
          template: 'ARTIST_CLAIM_STATUS#${status}',
        },
        sk: {
          field: 'gsi1sk',
          composite: ['createdAt'],
          template: '${createdAt}',
        },
      },
      // "What has this user claimed" (getUserClaims). NOT sparse, though it was designed
      // to be: ElectroDB writes `artist_claim_user#` with an empty suffix for invite rows
      // rather than omitting the index, so every invite shares one partition. Verified via
      // .params(). getUserClaims guards against a blank argument; the structural fix is
      // still owed — see STATE.md.
      byUser: {
        index: 'gsi2',
        pk: {
          field: 'gsi2pk',
          composite: ['userId'],
          template: 'ARTIST_CLAIM_USER#${userId}',
        },
        sk: {
          field: 'gsi2sk',
          composite: ['createdAt'],
          template: '${createdAt}',
        },
      },
      // "Which artists is this email pre-authorized for" (getClaimsByEmail, §4.3.1),
      // answered at login without a scan. Also NOT sparse — see byUser above; claim rows
      // land under an empty `artist_claim_email#`. This is the authorization lookup, so
      // the empty-argument guard in getClaimsByEmail matters most here.
      byEmail: {
        index: 'gsi3',
        pk: {
          field: 'gsi3pk',
          composite: ['email'],
          template: 'ARTIST_CLAIM_EMAIL#${email}',
        },
        sk: {
          field: 'gsi3sk',
          composite: ['createdAt'],
          template: '${createdAt}',
        },
      },
    },
  },
  { client: dynamoClient, table: process.env.DYNAMODB_TABLE || 'RasikaLifeTable' }
);

export type ArtistClaim = EntityItem<typeof ArtistClaimEntity>;
