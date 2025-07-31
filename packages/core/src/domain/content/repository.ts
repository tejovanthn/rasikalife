/**
 * Content repository following artist domain pattern
 */
import { putItem, updateItem } from '../../db';
import { getByGlobalIndex, getByPrimaryKey } from '../../shared/accessPatterns';
import {
  EntityPrefix,
  SecondaryPrefix,
  createBaseItem,
  formatIndexKey,
  formatKey,
} from '../../shared/singleTable';
import { createContentSchema, updateContentSchema } from './schema';
import { ContentCategory, ContentStatus, ContentVisibility } from './schema';
import type { ContentDynamoItem, UpdateContentDynamoItem } from './types';

/**
 * Content repository
 */
export class ContentRepository {
  /**
   * Create a new content item
   */
  static async create(input: unknown): Promise<ContentDynamoItem> {
    const validatedInput = createContentSchema.parse(input);

    const baseItem = await createBaseItem(EntityPrefix.CONTENT);

    const contentItem: ContentDynamoItem = {
      ...baseItem,
      ...validatedInput,
      createdBy: validatedInput.editorId,
      updatedBy: validatedInput.editorId,
      editedBy: [validatedInput.editorId],

      // Content-specific defaults
      viewCount: 0,
      version: 'v1',
      isLatest: true,

      // GSI fields for efficient queries
      GSI1PK: formatIndexKey('CONTENT_CATEGORY', validatedInput.category),
      GSI1SK: formatKey(EntityPrefix.CONTENT, baseItem.id),

      GSI2PK: formatIndexKey('CONTENT_STATUS', validatedInput.status),
      GSI2SK: formatKey(EntityPrefix.CONTENT, baseItem.id),

      GSI3PK: 'CONTENT_PATH',
      GSI3SK: validatedInput.path,
    };

    await putItem(contentItem);
    return contentItem;
  }

  /**
   * Get content by ID
   */
  static async getById(id: string): Promise<ContentDynamoItem | null> {
    return getByPrimaryKey<ContentDynamoItem>(EntityPrefix.CONTENT, id, SecondaryPrefix.METADATA);
  }

  /**
   * Get content by path using GSI3
   */
  static async getByPath(path: string): Promise<ContentDynamoItem | null> {
    const results = await getByGlobalIndex<ContentDynamoItem>('GSI3', 'GSI3PK', 'CONTENT_PATH', {
      sortKeyName: 'GSI3SK',
      sortKeyValue: path,
      limit: 1,
    });
    return results.items.length > 0 ? results.items[0] : null;
  }

  /**
   * Update content
   */
  static async update(id: string, input: unknown): Promise<ContentDynamoItem> {
    const validatedInput: UpdateContentDynamoItem = updateContentSchema.parse({
      id,
      ...(input || {}),
    });

    // Update GSI fields if relevant fields are changing
    if (validatedInput.category) {
      validatedInput.GSI1PK = formatIndexKey('CONTENT_CATEGORY', validatedInput.category);
    }

    if (validatedInput.status) {
      validatedInput.GSI2PK = formatIndexKey('CONTENT_STATUS', validatedInput.status);
    }

    if (validatedInput.path) {
      validatedInput.GSI3SK = validatedInput.path;
    }

    if (validatedInput.editorId) {
      validatedInput.updatedBy = validatedInput.editorId;
      // Add to editedBy array if not already present
      const existing = await ContentRepository.getById(id);
      if (existing) {
        const editedBy = existing.editedBy || [];
        if (!editedBy.includes(validatedInput.editorId)) {
          validatedInput.editedBy = [...editedBy, validatedInput.editorId];
        }
      }
    }

    return updateItem<ContentDynamoItem>(
      {
        PK: formatKey(EntityPrefix.CONTENT, id),
        SK: SecondaryPrefix.METADATA,
      },
      validatedInput
    );
  }
}
