// packages/core/src/domain/search/transformer.test.ts
//
// index.test.ts already covers transformArtistToDocument, transformCompositionToDocument,
// transformVenueToDocument, transformOrganiserToDocument, and transformEventToDocument.
// This file covers the remaining transforms plus the aggregate function.

import { describe, expect, it } from 'vitest';
import type { Festival } from '../festival/entity';
import type { Raga } from '../raga';
import type { Tala } from '../tala';
import {
  transformFestivalToDocument,
  transformRagaToDocument,
  transformTalaToDocument,
  transformToSearchDocuments,
} from './transformer';

describe('transformRagaToDocument', () => {
  it('transforms a raga into a search document with an empty description', () => {
    const raga = { id: 'raga-1', name: 'Hamsadhwani' } as Raga;

    const doc = transformRagaToDocument(raga);

    expect(doc).toMatchObject({
      id: 'raga-1',
      entityType: 'raga',
      name: 'Hamsadhwani',
      displayName: 'Hamsadhwani',
      description: '',
    });
    expect(typeof doc.indexedAt).toBe('string');
  });
});

describe('transformTalaToDocument', () => {
  it('transforms a tala into a search document with an empty description', () => {
    const tala = { id: 'tala-1', name: 'Adi' } as Tala;

    const doc = transformTalaToDocument(tala);

    expect(doc).toMatchObject({
      id: 'tala-1',
      entityType: 'tala',
      name: 'Adi',
      displayName: 'Adi',
      description: '',
    });
  });
});

describe('transformFestivalToDocument', () => {
  it('joins organiser name and tags into the description', () => {
    const festival = {
      id: 'festival-1',
      name: 'Margazhi Season',
      organiserName: 'Madras Music Academy',
      tags: ['carnatic', 'december'],
    } as unknown as Festival;

    const doc = transformFestivalToDocument(festival);

    expect(doc.id).toBe('festival-1');
    expect(doc.entityType).toBe('festival');
    expect(doc.name).toBe('Margazhi Season');
    expect(doc.description).toBe('Madras Music Academy carnatic december');
  });

  it('handles a festival with no organiser name or tags', () => {
    const festival = { id: 'festival-2', name: 'Unnamed Fest' } as unknown as Festival;

    const doc = transformFestivalToDocument(festival);

    expect(doc.description).toBe('');
  });
});

describe('transformToSearchDocuments', () => {
  it('flattens all entity collections into a single document array, in entity-type order', () => {
    const artist = { id: 'a1', name: 'Artist' } as never;
    const raga = { id: 'r1', name: 'Raga' } as Raga;
    const tala = { id: 't1', name: 'Tala' } as Tala;
    const venue = { id: 'v1', name: 'Venue' } as never;
    const organiser = { id: 'o1', name: 'Organiser' } as never;
    const event = { id: 'e1', title: 'Event', artists: [] } as never;
    const festival = { id: 'f1', name: 'Festival' } as unknown as Festival;

    const docs = transformToSearchDocuments(
      [artist],
      [raga],
      [tala],
      [],
      [venue],
      [organiser],
      [event],
      [festival]
    );

    expect(docs.map(d => d.entityType)).toEqual([
      'artist',
      'raga',
      'tala',
      'venue',
      'organiser',
      'event',
      'festival',
    ]);
    expect(docs).toHaveLength(7);
  });

  it('returns an empty array when every collection is empty', () => {
    expect(transformToSearchDocuments([], [], [], [], [], [], [], [])).toEqual([]);
  });
});
