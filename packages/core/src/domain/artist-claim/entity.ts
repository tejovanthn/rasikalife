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
      // When the invite this claim was redeemed from was written. Its own createdAt is the
      // moment of redemption, which is not the same question — "when did a moderator decide
      // to trust this address" is the audit trail, and it would otherwise be destroyed with
      // the invite row.
      invitedAt: {
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
      // One index answers both "what has this user claimed" (getUserClaims) and "which
      // artists is this email pre-authorized for" (getClaimsByEmail, §4.3.1, the
      // login-time check) — `kind` separates them, so the two never collide.
      //
      // It keys off `subject` rather than `userId`/`email` because subject is required and
      // therefore always present. A pair of indexes on the optional fields was the obvious
      // shape and is a trap: ElectroDB does not omit an index whose composite is missing,
      // it writes the template with an empty suffix, so every invite would have shared one
      // `artist_claim_user#` partition and every claim one `artist_claim_email#`. That is a
      // hot key, and on the byEmail side it is an authorization lookup returning every
      // pre-authorized artist to a blank argument. Keying on an always-present attribute
      // removes the empty partition instead of guarding it, and costs one GSI slot less.
      byActor: {
        index: 'gsi2',
        pk: {
          field: 'gsi2pk',
          composite: ['kind', 'subject'],
          template: 'ARTIST_CLAIM_ACTOR#${kind}#${subject}',
        },
        sk: {
          field: 'gsi2sk',
          composite: ['createdAt'],
          template: '${createdAt}',
        },
      },
    },
  },
  { client: dynamoClient, table: process.env.DYNAMODB_TABLE || 'RasikaLifeTable' }
);

export type ArtistClaim = EntityItem<typeof ArtistClaimEntity>;
