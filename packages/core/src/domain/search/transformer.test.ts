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

describe('transformRagaToDocument scale and volume', () => {
  it('carries the scale and the search volume for ragaRelatives', () => {
    const raga = {
      id: 'r',
      name: 'bhairavi',
      arohanam: 'S R2 G2 M1 P D2 N2 S',
      avarohanam: 'S N2 D1 P M1 G2 R2 S',
      searchVolume: 12100,
    } as Raga;
    const doc = transformRagaToDocument(raga);
    expect(doc.arohanam).toBe('S R2 G2 M1 P D2 N2 S');
    expect(doc.avarohanam).toBe('S N2 D1 P M1 G2 R2 S');
    expect(doc.popularity).toBe(12100);
  });

  it('leaves both out when nothing is stored', () => {
    const doc = transformRagaToDocument({ id: 'r', name: 'bare' } as Raga);
    expect(doc).not.toHaveProperty('arohanam');
    expect(doc).not.toHaveProperty('popularity');
  });
});

describe('transformRagaToDocument noindex', () => {
  it('never marks noindex when the composition count is unknown', () => {
    const doc = transformRagaToDocument({ id: 'r', name: 'Bare' } as Raga);
    expect(doc.noindex).toBeUndefined();
  });

  it('marks a bare raga with no compositions noindex', () => {
    const doc = transformRagaToDocument({ id: 'r', name: 'Bare' } as Raga, 0);
    expect(doc.noindex).toBe(true);
  });

  it('leaves a raga with a scale or a composition indexable', () => {
    const withScale = { id: 'r', name: 'Mohanam', arohanam: 'S R2 G3 P D2 S' } as Raga;
    expect(transformRagaToDocument(withScale, 0).noindex).toBeUndefined();
    expect(transformRagaToDocument({ id: 'r', name: 'Bare' } as Raga, 1).noindex).toBeUndefined();
  });

  it('keeps an allowlisted raga in the sitemap', () => {
    const raga = { id: '3A73KrTU0EgXIV0W20AGmQSDsZw', name: 'Rajalahari' } as Raga;
    expect(transformRagaToDocument(raga, 0).noindex).toBeUndefined();
  });

  it('counts compositions per raga across the corpus', () => {
    const docs = transformToSearchDocuments(
      [],
      [{ id: 'sung', name: 'Sung' } as Raga, { id: 'bare', name: 'Bare' } as Raga],
      [],
      [{ id: 'c1', title: 'Kriti', ragas: [{ id: 'sung', name: 'Sung' }] } as never],
      [],
      [],
      [],
      []
    );
    const byId = Object.fromEntries(docs.map(d => [d.id, d]));
    expect(byId.sung.noindex).toBeUndefined();
    expect(byId.bare.noindex).toBe(true);
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

describe('transformVenueToDocument city', () => {
  it('carries the stored city, address first, for the city pages', async () => {
    const { transformVenueToDocument } = await import('./transformer');
    const venue = { id: 'v1', name: 'Hall', city: 'Bangalore', address: { city: 'Bengaluru' } };
    expect(transformVenueToDocument(venue as never).city).toBe('Bengaluru');
    expect(transformVenueToDocument({ id: 'v2', name: 'Bare' } as never).city).toBeUndefined();
  });
});
