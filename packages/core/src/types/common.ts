/**
 * Common type definitions used across the Rasika.life application
 */

import type { ErrorCodeType } from '@/constants/errorCodes';
import type { PaginationParams, PaginationResult } from '@/db/queryBuilder';

// Base application error
export class ApplicationError extends Error {
  code: ErrorCodeType;

  constructor(code: ErrorCodeType, message: string) {
    super(message);
    this.code = code;
    Object.setPrototypeOf(this, ApplicationError.prototype);
  }
}

// Common entity types
export type EntityType =
  | 'user'
  | 'artist'
  | 'composition'
  | 'raga'
  | 'tala'
  | 'event'
  | 'venue'
  | 'thread'
  | 'reply'
  | 'update'
  | 'collection';

// Base entity interface with common properties
export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

// Generic type for repository operations
export interface Repository<T extends BaseEntity, K = string> {
  create(item: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T>;
  getById(id: K): Promise<T | null>;
  update(id: K, item: Partial<T>): Promise<T>;
  delete(id: K): Promise<void>;
  list(params?: PaginationParams): Promise<PaginationResult<T>>;
}

// Version control interface for wiki-style entities
export interface VersionedEntity extends BaseEntity {
  version: string;
}

// Social links common structure
export interface SocialLinks {
  website?: string;
  youtube?: string;
  instagram?: string;
  facebook?: string;
  twitter?: string;
  spotify?: string;
  appleMusic?: string;
  other?: Record<string, string>;
}

// Location structure
export interface Location {
  city?: string;
  state?: string;
  country: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}
