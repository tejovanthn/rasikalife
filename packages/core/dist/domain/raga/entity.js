import { Entity } from 'electrodb';
import { dynamoClient } from '../../db/client';
export const RagaEntity = new Entity({
    model: {
        entity: 'raga',
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
                template: 'RAGA#${id}',
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
                template: 'RAGA_NAME#${name}',
            },
            sk: {
                field: 'gsi1sk',
                composite: ['id'],
                template: 'RAGA#${id}',
            },
        },
    },
}, { client: dynamoClient, table: process.env.DYNAMODB_TABLE || 'RasikaLifeTable' });
