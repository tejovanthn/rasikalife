// packages/core/src/domain/search/transformer.ts

import type { Artist } from '../artist';
import { artistPopularity } from '../artist/popularity';
import type { CompositionWithRelations } from '../composition';
import type { Event } from '../event';
import type { Festival } from '../festival';
import type { Organiser } from '../organiser';
import type { Raga } from '../raga';
import { isThinRaga } from '../raga/thin';
import type { Tala } from '../tala';
import type { Venue } from '../venue';
import type { EntityType, SearchDocument } from './types';

function createDocument(
  id: string,
  entityType: EntityType,
  name: string,
  description: string
): SearchDocument {
  return {
    id,
    entityType,
    name,
    description,
    displayName: name,
    indexedAt: new Date().toISOString(),
  };
}

/**
 * `popularity` is known only when the whole corpus is being indexed, like a raga's
 * composition count; a partial update leaves it out rather than writing a zero.
 */
export function transformArtistToDocument(artist: Artist, popularity?: number): SearchDocument {
  const doc = createDocument(
    artist.id,
    'artist',
    artist.name,
    (artist.alternateNames || []).join(' ')
  );
  if (popularity !== undefined) doc.popularity = popularity;
  if (artist.claimStatus === 'verified') doc.verified = true;
  return doc;
}

/**
 * `compositionCount` is known only when the whole corpus is being indexed.
 * Without it the raga is never marked `noindex`, so a partial update cannot
 * drop a page from the sitemap by mistake.
 */
export function transformRagaToDocument(raga: Raga, compositionCount?: number): SearchDocument {
  const doc = createDocument(raga.id, 'raga', raga.name, '');
  if (compositionCount !== undefined && isThinRaga({ ...raga, compositionCount })) {
    doc.noindex = true;
  }
  return doc;
}

export function transformTalaToDocument(tala: Tala): SearchDocument {
  return createDocument(tala.id, 'tala', tala.name, '');
}

export function transformCompositionToDocument(
  composition: CompositionWithRelations
): SearchDocument {
  const parts = [
    composition.composer?.name || '',
    (composition.ragas || []).map(r => r.name).join(' '),
    (composition.talas || []).map(t => t.name).join(' '),
    (composition.lyricsV1 || []).map(l => l.text).join(' '),
  ];

  return createDocument(
    composition.id,
    'composition',
    composition.title,
    parts.filter(Boolean).join(' ')
  );
}

export function transformVenueToDocument(venue: Venue): SearchDocument {
  const parts = [venue.city || '', ...(venue.alternateNames || [])];
  const doc = createDocument(venue.id, 'venue', venue.name, parts.filter(Boolean).join(' '));
  const city = venue.address?.city || venue.city;
  if (city) doc.city = city;
  return doc;
}

export function transformOrganiserToDocument(organiser: Organiser): SearchDocument {
  return createDocument(
    organiser.id,
    'organiser',
    organiser.name,
    (organiser.alternateNames || []).join(' ')
  );
}

export function transformEventToDocument(event: Event): SearchDocument {
  const parts = [
    (event.artists || []).map(a => a.name).join(' '),
    event.venueName || '',
    event.organiserName || '',
  ];

  return createDocument(event.id, 'event', event.title, parts.filter(Boolean).join(' '));
}

export function transformFestivalToDocument(festival: Festival): SearchDocument {
  const parts = [festival.organiserName || '', (festival.tags || []).join(' ')];

  return createDocument(festival.id, 'festival', festival.name, parts.filter(Boolean).join(' '));
}

export function transformToSearchDocuments(
  artists: Artist[],
  ragas: Raga[],
  talas: Tala[],
  compositions: CompositionWithRelations[],
  venues: Venue[],
  organisers: Organiser[],
  events: Event[],
  festivals: Festival[]
): SearchDocument[] {
  const popularity = artistPopularity(events);
  const compositionsPerRaga = new Map<string, number>();
  for (const composition of compositions) {
    for (const r of composition.ragas || []) {
      compositionsPerRaga.set(r.id, (compositionsPerRaga.get(r.id) ?? 0) + 1);
    }
  }

  return [
    ...artists.map(a => transformArtistToDocument(a, popularity.get(a.id) ?? 0)),
    ...ragas.map(r => transformRagaToDocument(r, compositionsPerRaga.get(r.id) ?? 0)),
    ...talas.map(transformTalaToDocument),
    ...compositions.map(transformCompositionToDocument),
    ...venues.map(transformVenueToDocument),
    ...organisers.map(transformOrganiserToDocument),
    ...events.map(transformEventToDocument),
    ...festivals.map(transformFestivalToDocument),
  ];
}
