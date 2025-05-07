/**
 * Utilities for working with the single-table design pattern
 */
import { DynamoItem } from '../db/queryBuilder';
import { getCurrentISOString } from '../utils/dateTime';
import { generateId } from '../utils/id';

/**
 * Types of keys in the single-table design
 */
export enum KeyType {
  PK = 'PK',
  SK = 'SK',
  GSI1PK = 'GSI1PK',
  GSI1SK = 'GSI1SK',
  GSI2PK = 'GSI2PK',
  GSI2SK = 'GSI2SK',
  GSI3PK = 'GSI3PK',
  GSI3SK = 'GSI3SK',
  GSI4PK = 'GSI4PK',
  GSI4SK = 'GSI4SK',
  LSI1SK = 'LSI1SK',
}

/**
 * Entity types used in key prefixes
 */
export enum EntityPrefix {
  USER = 'USER',
  ARTIST = 'ARTIST',
  COMPOSITION = 'COMPOSITION',
  RAGA = 'RAGA',
  TALA = 'TALA',
  EVENT = 'EVENT',
  VENUE = 'VENUE',
  THREAD = 'THREAD',
  REPLY = 'REPLY',
  UPDATE = 'UPDATE',
  COLLECTION = 'COLLECTION',
  WHATSAPP = 'WHATSAPP',
  EMAIL = 'EMAIL',
  USERNAME = 'USERNAME',
}

/**
 * Secondary field types used in key prefixes
 */
export enum SecondaryPrefix {
  METADATA = '#METADATA',
  VERSION = 'VERSION',
  LATEST = 'LATEST',
  KARMA = 'KARMA',
  BADGE = 'BADGE',
  FOLLOWS = 'FOLLOWS',
  FOLLOWER = 'FOLLOWER',
  FAVORITE = 'FAVORITE',
  VOTE = 'VOTE',
  SUBSCRIPTION = 'SUBSCRIPTION',
  HISTORY = 'HISTORY',
  FEATURED = 'FEATURED',
  STATUS = 'STATUS',
  DATE = 'DATE',
}

/**
 * Format a key with entity prefix and ID
 * 
 * @param prefix - Entity type prefix
 * @param id - Entity ID
 * @returns Formatted key (e.g., "USER#123")
 */
export const formatKey = (prefix: EntityPrefix | string, id: string): string => {
  return `${prefix}#${id}`;
};

/**
 * Format a date-based sort key
 * 
 * @param prefix - Sort key prefix
 * @param date - Date string in YYYY-MM-DD format
 * @param id - Optional ID to append
 * @returns Formatted date key (e.g., "DATE#2023-01-01#ITEM#123")
 */
export const formatDateSortKey = (
  prefix: SecondaryPrefix | string,
  date: string,
  id?: string
): string => {
  return id 
    ? `${prefix}#${date}#${id}`
    : `${prefix}#${date}`;
};

/**
 * Create a version sort key
 * 
 * @param version - Version string
 * @param timestamp - Optional timestamp
 * @returns Formatted version key (e.g., "VERSION#v1#2023-01-01T00:00:00.000Z")
 */
export const formatVersionKey = (
  version: string,
  timestamp?: string
): string => {
  return timestamp
    ? `${SecondaryPrefix.VERSION}#${version}#${timestamp}`
    : `${SecondaryPrefix.VERSION}#${version}`;
};

/**
 * Create a base DynamoDB item for a new entity
 * 
 * @param entityType - Type of entity (USER, ARTIST, etc.)
 * @param id - Optional ID (will be generated if not provided)
 * @param sortKey - Optional sort key (defaults to #METADATA)
 * @returns Promise with base item structure
 */
export const createBaseItem = async (
  entityType: EntityPrefix,
  id?: string,
  sortKey: string = SecondaryPrefix.METADATA
): Promise<DynamoItem> => {
  const entityId = id || await generateId();
  const now = getCurrentISOString();
  
  return {
    PK: formatKey(entityType, entityId),
    SK: sortKey,
    id: entityId,
    createdAt: now,
    updatedAt: now,
  };
};

/**
 * Create a composite ID for entities that need a compound key
 * 
 * @param parts - Array of ID parts to join
 * @returns Composite ID string
 */
export const createCompositeId = (parts: string[]): string => {
  return parts.join('_');
};

/**
 * Format a secondary index key
 * 
 * @param prefix - Index key prefix
 * @param value - Value to include in the key
 * @returns Formatted GSI key (e.g., "EMAIL#test@example.com")
 */
export const formatIndexKey = (prefix: string, value: string): string => {
  return `${prefix}#${value}`;
};

/**
 * Extract ID from a formatted key
 * 
 * @param key - Formatted key (e.g., "USER#123")
 * @returns The extracted ID
 */
export const extractIdFromKey = (key: string): string => {
  return key.split('#')[1];
};

/**
 * Add timestamps to an item for updates
 * 
 * @param item - The item to update
 * @returns The item with updated timestamp
 */
export const addUpdateTimestamp = <T extends { updatedAt?: string }>(item: T): T => {
  return {
    ...item,
    updatedAt: getCurrentISOString(),
  };
};