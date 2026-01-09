import type { DynamoItem } from '../../db';
import type { Tradition } from '../artist';
import type { Composition, CompositionAttribution } from './schema';

export interface CompositionDynamoItem extends DynamoItem, Composition {}
export interface AttributionDynamoItem extends DynamoItem, CompositionAttribution {}

// Structured verse interface
export interface Verse {
  type: 'pallavi' | 'anupallavi' | 'caraNam' | 'lyrics';
  order: number;
  text: string;
}

// Composition metadata interface
export interface CompositionMetadata {
  hasRagaDetails?: boolean;
  hasTalaDetails?: boolean;
  lyricSections?: number;
  sectionTypes?: string[];
}

export interface CompositionSearchParams {
  query?: string;
  ragaId?: string;
  talaId?: string;
  artistId?: string;
  language?: string;
  tradition?: Tradition;
  limit?: number;
  nextToken?: string;
}

export interface CompositionSearchResult {
  items: Composition[];
  nextToken?: string;
  hasMore: boolean;
}

export enum AttributionType {
  PRIMARY = 'primary',
  DISPUTED = 'disputed',
  ALTERNATIVE = 'alternative',
  TRADITIONAL = 'traditional',
}

export enum AttributionConfidence {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

export interface AttributionSearchParams {
  compositionId?: string;
  artistId?: string;
  attributionType?: AttributionType;
  limit?: number;
  nextToken?: string;
}

export interface AttributionSearchResult {
  items: CompositionAttribution[];
  nextToken?: string;
  hasMore: boolean;
}

export interface CompositionWithAttributions extends Composition {
  attributions: CompositionAttribution[];
  // Denormalized data for UI convenience - primary raga/tala (first in arrays)
  ragaName?: string;
  ragaId?: string;
  talaName?: string;
  talaId?: string;
  // Full denormalized data for all ragas/talas
  ragas?: Array<{ id: string; name: string }>;
  talas?: Array<{ id: string; name: string }>;
  // Artist attributions for convenience
  composers?: Array<{ id: string; name: string; attributionType: AttributionType }>;
}
