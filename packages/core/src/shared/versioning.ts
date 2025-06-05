/**
 * Shared versioning service for wiki-style entities
 * 
 * This service provides common versioning operations for entities that support
 * wiki-style editing with version history, latest pointers, and denormalized data.
 */
import type { ZodSchema } from 'zod';
import { batchPutItems, getByPrimaryKey } from '../db';
import { getAllByPartitionKey } from './accessPatterns';
import { 
  createBaseItem, 
  EntityPrefix, 
  formatKey, 
  formatVersionKey,
  type DynamoItem 
} from './singleTable';
import { getCurrentISOString } from '../utils';

/**
 * Configuration for versioning operations
 */
export interface VersioningConfig<TEntity, TDynamoItem extends DynamoItem, TCreateInput, TUpdateInput> {
  entityPrefix: EntityPrefix;
  schema: ZodSchema<TEntity>;
  /**
   * Function to apply entity-specific GSI mappings
   * @param item The dynamo item being created/updated
   * @param input The input data
   * @returns Partial item with GSI fields set
   */
  applyGSIMappings: (item: TDynamoItem, input: TCreateInput | TUpdateInput) => Partial<TDynamoItem>;
  /**
   * Function to apply entity-specific default fields during creation
   * @param input The input data
   * @returns Partial item with entity-specific defaults
   */
  applyDefaults?: (input: TCreateInput) => Partial<TDynamoItem>;
}

/**
 * Version history item structure
 */
export interface EntityVersion {
  id: string;
  version: string;
  timestamp: string;
  editorId: string;
}

/**
 * Base input interface that all versioned entities must implement
 */
export interface VersionedEntityInput {
  editorId: string;
}

/**
 * Shared versioning service
 */
export class VersioningService {
  /**
   * Create a new versioned entity
   */
  static async create<TEntity, TDynamoItem extends DynamoItem, TCreateInput extends VersionedEntityInput>(
    input: TCreateInput,
    config: VersioningConfig<TEntity, TDynamoItem, TCreateInput, any>
  ): Promise<TEntity> {
    const baseItem = await createBaseItem(config.entityPrefix);
    const timestamp = getCurrentISOString();
    const version = 'v1';

    // Create primary version record
    const entityItem: TDynamoItem = {
      ...baseItem,
      ...input,
      id: baseItem.id,
      createdAt: baseItem.createdAt,
      version,
      viewCount: 0,
      editedBy: [input.editorId],
      isLatest: true,
      updatedAt: timestamp,

      // Dynamo specific fields
      SK: formatVersionKey(version, timestamp),
    } as TDynamoItem;

    // Apply entity-specific defaults
    if (config.applyDefaults) {
      const defaults = config.applyDefaults(input);
      Object.assign(entityItem, defaults);
    }

    // Apply entity-specific GSI mappings
    const gsiMappings = config.applyGSIMappings(entityItem, input);
    Object.assign(entityItem, gsiMappings);

    // Optimized latest pointer with denormalized data
    const latestPointer: TDynamoItem = {
      ...entityItem,
      PK: entityItem.PK,
      SK: 'VERSION#LATEST',
      version,
      timestamp,
      isLatest: true,
    } as TDynamoItem;

    // Create records in a transaction
    await batchPutItems([entityItem, latestPointer]);

    return config.schema.parse(entityItem);
  }

  /**
   * Update an existing versioned entity (creates new version)
   */
  static async update<TEntity, TDynamoItem extends DynamoItem, TUpdateInput extends VersionedEntityInput>(
    id: string,
    input: TUpdateInput,
    config: VersioningConfig<TEntity, TDynamoItem, any, TUpdateInput>,
    getCurrentEntity: (id: string) => Promise<TEntity | null>
  ): Promise<TEntity> {
    // Get current latest version
    const current = await getCurrentEntity(id);
    if (!current) {
      throw new Error(`Entity ${id} not found`);
    }

    // Create new version number
    const currentVersion = (current as any).version;
    const versionNum = Number.parseInt(currentVersion.replace('v', ''));
    const newVersion = `v${versionNum + 1}`;
    const timestamp = getCurrentISOString();

    // Build new version with updates
    const entityItem: TDynamoItem = {
      ...current,
      ...input,
      version: newVersion,
      updatedAt: timestamp,
      editedBy: [...new Set([...(current as any).editedBy, input.editorId])],

      // Keys - maintain same PK but new version SK
      PK: formatKey(config.entityPrefix, id),
      SK: formatVersionKey(newVersion, timestamp),
    } as TDynamoItem;

    // Apply entity-specific GSI mappings for updated fields
    const gsiMappings = config.applyGSIMappings(entityItem, input);
    Object.assign(entityItem, gsiMappings);

    // Optimized latest pointer with denormalized data
    const latestPointer: TDynamoItem = {
      ...entityItem,
      PK: entityItem.PK,
      SK: 'VERSION#LATEST',
      version: newVersion,
      timestamp,
      isLatest: true,
    } as TDynamoItem;

    // Optimized: Only 2 operations instead of 3 (removed old version update)
    await batchPutItems([entityItem, latestPointer]);

    return config.schema.parse(entityItem);
  }

  /**
   * Get entity by ID (latest version or specific version)
   */
  static async getById<TEntity, TDynamoItem extends DynamoItem>(
    id: string,
    config: VersioningConfig<TEntity, TDynamoItem, any, any>,
    version?: string
  ): Promise<TEntity | null> {
    if (version) {
      // Get specific version
      return getByPrimaryKey<TDynamoItem>(
        config.entityPrefix,
        id,
        formatVersionKey(version)
      );
    }

    // Optimized: Get latest version data directly from denormalized pointer (single lookup)
    return getByPrimaryKey<TDynamoItem>(
      config.entityPrefix,
      id,
      'VERSION#LATEST'
    );
  }

  /**
   * Get version history for an entity
   */
  static async getVersionHistory(
    id: string,
    entityPrefix: EntityPrefix
  ): Promise<EntityVersion[]> {
    // Query all versions
    const result = await getAllByPartitionKey(entityPrefix, id, {
      sortKeyPrefix: 'VERSION#v',
    });

    return result.items.map(item => ({
      id,
      version: item.version,
      timestamp: item.updatedAt || item.createdAt,
      editorId: item.editedBy[item.editedBy.length - 1],
    }));
  }

  /**
   * Increment view count for the latest version of an entity
   */
  static async incrementViewCount(
    id: string,
    entityPrefix: EntityPrefix
  ): Promise<void> {
    // This would require importing updateItem, but keeping it simple for now
    // Each repository can implement this using the shared pattern if needed
    throw new Error('incrementViewCount should be implemented in individual repositories for now');
  }
}