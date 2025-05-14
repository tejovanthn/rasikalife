import type { DynamoItem } from '@/db';
import type { Tradition } from '../artist';
import type { Composition, CompositionAttribution } from './schema';

export interface CompositionDynamoItem extends DynamoItem, Composition {}
export interface AttributionDynamoItem extends DynamoItem, CompositionAttribution {}

export interface CompositionVersion {
  id: string;
  version: string;
  timestamp: string;
  editorId: string;
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
}
