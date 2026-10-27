import { Entity } from 'electrodb';
import type { EntityItem } from 'electrodb';
import { dynamoClient } from '../../db/client';

/**
 * A work that a fact on the site is taken from: a book, an article, a web page, a paper.
 *
 * Keyed on a readable slug (`ssp-1963-tamil`), not a KSUID. A citation names its source in
 * CSVs, research packets and rasika-books output, and a person checking one has to be able to
 * tell which book it is from the cell. The slug is rasika-books' `book_id` for a book that
 * went through that pipeline.
 */
export const SourceEntity = new Entity(
  {
    model: {
      entity: 'source',
      version: '1',
      service: 'rasikalife',
    },
    attributes: {
      slug: {
        type: 'string',
        required: true,
        readOnly: true,
      },
      title: {
        type: 'string',
        required: true,
      },
      /** The full reference as a reader would cite it: author, title, publisher, year. */
      citation: {
        type: 'string',
        required: true,
      },
      kind: {
        type: ['book', 'article', 'web', 'paper'] as const,
        required: true,
      },
      url: {
        type: 'string',
        required: false,
      },
      year: {
        type: 'number',
        required: false,
      },
      language: {
        type: 'string',
        required: false,
      },
      /** What we may do with it, shown beside the reference ("1904 original: public domain"). */
      licence: {
        type: 'string',
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
          composite: ['slug'],
          template: 'SOURCE#${slug}',
        },
        sk: {
          field: 'sk',
          composite: [],
          template: '#METADATA',
        },
      },
      list: {
        index: 'gsi2',
        pk: {
          field: 'gsi2pk',
          composite: [],
          template: 'SOURCE_LIST',
        },
        sk: {
          field: 'gsi2sk',
          composite: ['slug'],
          template: '${slug}',
        },
      },
    },
  },
  { client: dynamoClient, table: process.env.DYNAMODB_TABLE || 'RasikaLifeTable' }
);

export type Source = EntityItem<typeof SourceEntity>;
