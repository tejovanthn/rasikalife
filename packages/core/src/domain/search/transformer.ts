// packages/core/src/domain/search/transformer.ts

import type { Artist } from '../artist';
import type { CompositionWithRelations } from '../composition';
import type { Event } from '../event';
import type { Organiser } from '../organiser';
import type { Raga } from '../raga';
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

export function transformArtistToDocument(artist: Artist): SearchDocument {
  return createDocument(artist.id, 'artist', artist.name, '');
}

export function transformRagaToDocument(raga: Raga): SearchDocument {
  return createDocument(raga.id, 'raga', raga.name, '');
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
  return createDocument(venue.id, 'venue', venue.name, venue.city || '');
}

export function transformOrganiserToDocument(organiser: Organiser): SearchDocument {
  return createDocument(organiser.id, 'organiser', organiser.name, '');
}

export function transformEventToDocument(event: Event): SearchDocument {
  const parts = [
    (event.artists || []).map(a => a.name).join(' '),
    event.venueName || '',
    event.organiserName || '',
  ];

  return createDocument(event.id, 'event', event.title, parts.filter(Boolean).join(' '));
}

export function transformToSearchDocuments(
  artists: Artist[],
  ragas: Raga[],
  talas: Tala[],
  compositions: CompositionWithRelations[],
  venues: Venue[],
  organisers: Organiser[],
  events: Event[]
): SearchDocument[] {
  return [
    ...artists.map(transformArtistToDocument),
    ...ragas.map(transformRagaToDocument),
    ...talas.map(transformTalaToDocument),
    ...compositions.map(transformCompositionToDocument),
    ...venues.map(transformVenueToDocument),
    ...organisers.map(transformOrganiserToDocument),
    ...events.map(transformEventToDocument),
  ];
}
