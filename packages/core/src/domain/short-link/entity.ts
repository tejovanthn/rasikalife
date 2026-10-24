import { Entity } from 'electrodb';
import type { EntityItem } from 'electrodb';
import { dynamoClient } from '../../db/client';

/**
 * A short rasika.life link: `/l/<code>` stands for a longer path on this site, UTM tags
 * included. The code is derived from the target (`shortLinkCode`), so a row is never edited:
 * the same target always maps to the same code.
 */
export const ShortLinkEntity = new Entity(
  {
    model: {
      entity: 'shortLink',
      version: '1',
      service: 'rasikalife',
    },
    attributes: {
      code: {
        type: 'string',
        required: true,
        readOnly: true,
      },
      /** A path on this site with its query string, never an origin. */
      target: {
        type: 'string',
        required: true,
        readOnly: true,
      },
      createdAt: {
        type: 'string',
        required: true,
        default: () => new Date().toISOString(),
        readOnly: true,
      },
    },
    indexes: {
      primary: {
        pk: {
          field: 'pk',
          composite: ['code'],
          template: 'SHORTLINK#${code}',
        },
        sk: {
          field: 'sk',
          composite: [],
          template: '#METADATA',
        },
      },
    },
  },
  { client: dynamoClient, table: process.env.DYNAMODB_TABLE || 'RasikaLifeTable' }
);

export type ShortLink = EntityItem<typeof ShortLinkEntity>;
