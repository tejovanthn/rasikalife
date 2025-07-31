/**
 * Content service with business logic - following artist domain pattern
 */
import { ContentRepository } from './repository';
import { type Content, contentSchema } from './schema';

/**
 * Content service
 */
export class ContentService {
  /**
   * Create new content with validation
   */
  static async create(input: unknown): Promise<Content> {
    // Parse input to validate path format
    const parsed = contentSchema.pick({ path: true }).parse(input);

    // Check if path already exists
    const existing = await ContentRepository.getByPath(parsed.path);
    if (existing) {
      throw new Error(`Content with path '${parsed.path}' already exists`);
    }

    const contentItem = await ContentRepository.create(input);
    return contentSchema.parse(contentItem);
  }

  /**
   * Get content by ID
   */
  static async getById(id: string): Promise<Content | null> {
    const item = await ContentRepository.getById(id);
    return item ? contentSchema.parse(item) : null;
  }

  /**
   * Get content by path
   */
  static async getByPath(path: string): Promise<Content | null> {
    const item = await ContentRepository.getByPath(path);
    return item ? contentSchema.parse(item) : null;
  }

  /**
   * Update content
   */
  static async update(id: string, input: unknown): Promise<Content> {
    const contentItem = await ContentRepository.update(id, input);
    return contentSchema.parse(contentItem);
  }
}
