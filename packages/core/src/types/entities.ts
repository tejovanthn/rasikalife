// Standalone type exports to resolve namespace collision issues
// These allow importing types directly: import type { ArtistType } from '@rasika/core/types/entities'

export type { Artist as ArtistType } from '../domain/artist/entity';
export type { Composition as CompositionType } from '../domain/composition/entity';
export type { CompositionWithRelations } from '../domain/composition';
export type { Raga as RagaType } from '../domain/raga/entity';
export type { Tala as TalaType } from '../domain/tala/entity';
