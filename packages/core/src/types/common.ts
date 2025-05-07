/**
 * Common type definitions used across the Rasika.life application
 */

import { ErrorCodeType } from '../constants/errorCodes';

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

export type Tradition = 'carnatic' | 'hindustani';

// Base entity interface with common properties
export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

// Pagination input parameters
export interface PaginationParams {
  limit?: number;
  nextToken?: string;
}

// Pagination response
export interface PaginatedResult<T> {
  items: T[];
  nextToken?: string;
}

// DynamoDB key structure
export interface DynamoKey {
  PK: string;
  SK: string;
}

// Common structure for single-table design items
export interface DynamoItem extends DynamoKey {
  [key: string]: any;
  GSI1PK?: string;
  GSI1SK?: string;
  GSI2PK?: string;
  GSI2SK?: string;
  GSI3PK?: string;
  GSI3SK?: string;
  GSI4PK?: string;
  GSI4SK?: string;
  LSI1SK?: string;
}

// Generic type for repository operations
export interface Repository<T extends BaseEntity, K = string> {
  create(item: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T>;
  getById(id: K): Promise<T | null>;
  update(id: K, item: Partial<T>): Promise<T>;
  delete(id: K): Promise<void>;
  list(params?: PaginationParams): Promise<PaginatedResult<T>>;
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
  }
}