// packages/core/src/domain/search/transformer.ts

import type { Artist } from '../artist';
import type { CompositionWithRelations } from '../composition';
import type { Raga } from '../raga';
import type { Tala } from '../tala';
import type { SearchDocument } from './types';

export function transformArtistToDocument(artist: Artist): SearchDocument {
  return {
    id: artist.id,
    entityType: 'artist',
    artistName: artist.name,
    ragaName: '',
    talaName: '',
    compositionTitle: '',
    lyrics: '',
    displayName: artist.name,
    indexedAt: new Date().toISOString(),
  };
}

export function transformRagaToDocument(raga: Raga): SearchDocument {
  return {
    id: raga.id,
    entityType: 'raga',
    artistName: '',
    ragaName: raga.name,
    talaName: '',
    compositionTitle: '',
    lyrics: '',
    displayName: raga.name,
    indexedAt: new Date().toISOString(),
  };
}

export function transformTalaToDocument(tala: Tala): SearchDocument {
  return {
    id: tala.id,
    entityType: 'tala',
    artistName: '',
    ragaName: '',
    talaName: tala.name,
    compositionTitle: '',
    lyrics: '',
    displayName: tala.name,
    indexedAt: new Date().toISOString(),
  };
}

export function transformCompositionToDocument(
  composition: CompositionWithRelations
): SearchDocument {
  const lyricsText = (composition.lyricsV1 || []).map(l => l.text).join(' ');

  const ragaNames = (composition.ragas || []).map(r => r.name).join(' ');
  const talaNames = (composition.talas || []).map(t => t.name).join(' ');

  return {
    id: composition.id,
    entityType: 'composition',
    artistName: composition.composer?.name || '',
    ragaName: ragaNames,
    talaName: talaNames,
    compositionTitle: composition.title,
    lyrics: lyricsText,
    displayName: composition.title,
    indexedAt: new Date().toISOString(),
  };
}

export function transformToSearchDocuments(
  artists: Artist[],
  ragas: Raga[],
  talas: Tala[],
  compositions: CompositionWithRelations[]
): SearchDocument[] {
  return [
    ...artists.map(transformArtistToDocument),
    ...ragas.map(transformRagaToDocument),
    ...talas.map(transformTalaToDocument),
    ...compositions.map(transformCompositionToDocument),
  ];
}
