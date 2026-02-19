import { Entity } from 'electrodb';
import type { EntityItem } from 'electrodb';
import { dynamoClient } from '../../db/client';

export const EventEntity = new Entity(
  {
    model: {
      entity: 'event',
      version: '1',
      service: 'rasikalife',
    },
    attributes: {
      id: {
        type: 'string',
        required: true,
      },

      // Festival link (optional)
      festivalId: { type: 'string', required: false },
      festivalName: { type: 'string', required: false },

      // Poster
      posterUrl: { type: 'string', required: false },
      posterUploadId: { type: 'string', required: false },

      // Core event data
      title: { type: 'string', required: true },
      description: { type: 'string', required: false },
      startDateTime: { type: 'string', required: true },
      endDateTime: { type: 'string', required: false },
      timezone: { type: 'string', required: true, default: 'Asia/Kolkata' },

      // Venue (denormalized + linked)
      venueId: { type: 'string', required: false },
      venueName: { type: 'string', required: false },

      // Organiser (denormalized + linked)
      organiserId: { type: 'string', required: false },
      organiserName: { type: 'string', required: false },

      // Artists (denormalized for display, canonical links in EventArtist entity)
      artists: {
        type: 'list',
        items: {
          type: 'map',
          properties: {
            id: { type: 'string', required: false },
            title: { type: 'string', required: false },
            name: { type: 'string', required: true },
            role: { type: 'string', required: false },
          },
        },
        required: false,
        default: () => [],
      },

      // Classification
      artForm: { type: 'string', required: false },
      tags: {
        type: 'list',
        items: { type: 'string' },
        required: false,
        default: () => [],
      },

      // Entry & Ticketing
      entryType: { type: 'string', required: false, default: 'free' },
      ticketing: { type: 'any', required: false },
      contactInfo: { type: 'any', required: false },
      sponsors: { type: 'any', required: false },

      // Status
      status: { type: 'string', required: true, default: 'draft' },

      // Moderator tracking
      moderatorId: { type: 'string', required: false },
      moderatorNote: { type: 'string', required: false },
      submittedAt: { type: 'string', required: false },
      processedAt: { type: 'string', required: false },

      // Extraction metadata
      extractionConfidence: { type: 'number', required: false },
      extractionRawResponse: { type: 'string', required: false },
      extractionTimestamp: { type: 'string', required: false },

      // Soft delete
      deletedAt: { type: 'string', required: false },

      // Ownership & timestamps
      createdBy: { type: 'string', required: true },
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
          template: 'EVENT#${id}',
        },
        sk: {
          field: 'sk',
          composite: [],
          template: '#METADATA',
        },
      },
      byCreator: {
        index: 'gsi1',
        pk: {
          field: 'gsi1pk',
          composite: ['createdBy'],
          template: 'USER#${createdBy}',
        },
        sk: {
          field: 'gsi1sk',
          composite: ['createdAt'],
          template: 'EVENT#${createdAt}',
        },
      },
      byStatus: {
        index: 'gsi2',
        pk: {
          field: 'gsi2pk',
          composite: ['status'],
          template: 'EVENT_STATUS#${status}',
        },
        sk: {
          field: 'gsi2sk',
          composite: ['startDateTime'],
        },
      },
      byFestival: {
        index: 'gsi3',
        pk: {
          field: 'gsi3pk',
          composite: ['festivalId'],
          template: 'FESTIVAL#${festivalId}',
        },
        sk: {
          field: 'gsi3sk',
          composite: ['startDateTime'],
        },
      },
      byVenue: {
        index: 'gsi4',
        pk: {
          field: 'gsi4pk',
          composite: ['venueId'],
          template: 'VENUE#${venueId}',
        },
        sk: {
          field: 'gsi4sk',
          composite: ['startDateTime'],
        },
      },
      byOrganiser: {
        index: 'gsi5',
        pk: {
          field: 'gsi5pk',
          composite: ['organiserId'],
          template: 'ORGANISER#${organiserId}',
        },
        sk: {
          field: 'gsi5sk',
          composite: ['startDateTime'],
        },
      },
      byArtForm: {
        index: 'gsi6',
        pk: {
          field: 'gsi6pk',
          composite: ['artForm'],
          template: 'ARTFORM#${artForm}',
        },
        sk: {
          field: 'gsi6sk',
          composite: ['startDateTime'],
        },
      },
    },
  },
  { client: dynamoClient, table: process.env.DYNAMODB_TABLE || 'RasikaLifeTable' }
);

export type Event = EntityItem<typeof EventEntity>;
