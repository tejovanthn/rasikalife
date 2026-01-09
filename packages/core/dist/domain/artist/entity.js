import { Entity } from 'electrodb';
import { dynamoClient } from '../../db/client';
export const ArtistEntity = new Entity({
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
        artistType: {
            type: 'string',
            required: false,
            default: () => 'Artist',
        },
        bio: {
            type: 'string',
            required: false,
        },
        instruments: {
            type: 'list',
            items: {
                type: 'string',
            },
            required: false,
        },
        traditions: {
            type: 'list',
            items: {
                type: 'string',
            },
            required: false,
        },
        profileImage: {
            type: 'string',
            required: false,
        },
        isVerified: {
            type: 'boolean',
            required: false,
            default: () => false,
        },
        viewCount: {
            type: 'number',
            required: false,
            default: () => 0,
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
    },
}, { client: dynamoClient, table: process.env.DYNAMODB_TABLE || 'RasikaLifeTable' });
