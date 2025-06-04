// ../../domain/artist/types.ts
import type { DynamoItem } from '../../db';
import type { Artist } from './schema';

// Minimal types that can't be inferred from schemas
export interface ArtistDynamoItem extends DynamoItem, Artist {
  searchName: string; // Lowercase name for case-insensitive search
}
export type UpdateArtistDynamoItem = Partial<ArtistDynamoItem>;

export enum ArtistType {
  VOCALIST = 'vocalist',
  INSTRUMENTALIST = 'instrumentalist',
  DANCER = 'dancer',
  COMPOSER = 'composer',
  GROUP = 'group',
}

export enum VerificationStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
}

export enum Tradition {
  CARNATIC = 'carnatic',
  HINDUSTANI = 'hindustani',
}

// Repository-specific types
export interface ArtistSearchParams {
  query?: string;
  instrument?: string;
  tradition?: Tradition;
  location?: {
    country?: string;
    state?: string;
    city?: string;
  };
  limit?: number;
  nextToken?: string;
}

export interface ArtistSearchResult {
  items: Artist[];
  nextToken?: string;
  hasMore: boolean;
}
