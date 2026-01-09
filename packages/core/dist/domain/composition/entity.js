import { Entity } from 'electrodb';
import { dynamoClient } from '../../db/client';
export const CompositionEntity = new Entity({
    model: {
        entity: 'composition',
        version: '1',
        service: 'rasikalife',
    },
    attributes: {
        id: {
            type: 'string',
            required: true,
        },
        title: {
            type: 'string',
            required: true,
        },
        artistId: {
            type: 'string',
            required: true,
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
                template: 'COMPOSITION#${id}',
            },
            sk: {
                field: 'sk',
                composite: [],
                template: '#METADATA',
            },
        },
        byArtist: {
            index: 'gsi2',
            pk: {
                field: 'gsi2pk',
                composite: ['artistId'],
                template: 'ARTIST#${artistId}',
            },
            sk: {
                field: 'gsi2sk',
                composite: ['id'],
                template: 'COMPOSITION#${id}',
            },
        },
    },
}, { client: dynamoClient, table: process.env.DYNAMODB_TABLE || 'RasikaLifeTable' });
