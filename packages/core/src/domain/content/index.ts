import { generateId } from '../../utils';
import { ContentEntity } from './entity';
import type { Content } from './entity';
import type { z } from 'zod';
import type { CreateContentSchema, UpdateContentSchema } from './schema';

export type CreateContentInput = z.infer<typeof CreateContentSchema>;
export type UpdateContentInput = z.infer<typeof UpdateContentSchema>;

export interface ContentWithRelations {
  id: string;
  path: string;
  content: string;
  category: string;
  status: string;
  visibility: string;
  editorId: string;
  meta: {
    title: string;
    description: string;
    keywords: string[];
    robots?: string;
  };
  navigation?: {
    breadcrumbs: Array<{ label: string; path: string }>;
    menuPlacement?: { section: string; order: number };
    relatedPages: Array<{ title: string; path: string; description?: string }>;
  };
  createdAt: string;
  updatedAt: string;
}

export async function createContent(input: CreateContentInput): Promise<Content> {
  const result = await ContentEntity.create({
    id: generateId(),
    ...input,
  }).go();

  if (!result.data) throw new Error('Failed to create content');

  return result.data;
}

export async function getContent(id: string): Promise<ContentWithRelations | null> {
  const result = await ContentEntity.get({ id }).go();
  if (!result.data) return null;

  const content = result.data;
  return {
    id: content.id,
    path: content.path,
    content: content.content,
    category: content.category,
    status: content.status,
    visibility: content.visibility,
    editorId: content.editorId,
    meta: content.meta,
    navigation: content.navigation,
    createdAt: content.createdAt,
    updatedAt: content.updatedAt,
  };
}

export async function getContentByPath(path: string): Promise<ContentWithRelations | null> {
  const result = await ContentEntity.query.byPath({ path }).go();
  if (!result.data || result.data.length === 0) return null;

  const content = result.data[0];
  return {
    id: content.id,
    path: content.path,
    content: content.content,
    category: content.category,
    status: content.status,
    visibility: content.visibility,
    editorId: content.editorId,
    meta: content.meta,
    navigation: content.navigation,
    createdAt: content.createdAt,
    updatedAt: content.updatedAt,
  };
}

export async function getContentsByCategory(category: string): Promise<ContentWithRelations[]> {
  const result = await ContentEntity.query.byCategory({ category }).go();
  const contents = result.data || [];

  return contents.map(content => ({
    id: content.id,
    path: content.path,
    content: content.content,
    category: content.category,
    status: content.status,
    visibility: content.visibility,
    editorId: content.editorId,
    meta: content.meta,
    navigation: content.navigation,
    createdAt: content.createdAt,
    updatedAt: content.updatedAt,
  }));
}

export async function updateContent(id: string, input: UpdateContentInput): Promise<Content> {
  const definedData = Object.fromEntries(
    Object.entries(input).filter(([_, value]) => value !== undefined)
  );

  const result = await ContentEntity.update({ id }).set(definedData).go();

  if (!result.data) {
    throw new Error(`Content ${id} not found`);
  }

  return result.data as Content;
}

export async function deleteContent(id: string): Promise<void> {
  await ContentEntity.delete({ id }).go();
}

export async function listContents(params?: { limit?: number; nextToken?: string }): Promise<{
  items: ContentWithRelations[];
  nextToken?: string;
  hasMore: boolean;
}> {
  const limit = params?.limit || 20;
  const result = await ContentEntity.scan.go({
    limit,
    cursor: params?.nextToken,
  });

  const enrichedContents = (result.data || []).map(content => ({
    id: content.id,
    path: content.path,
    content: content.content,
    category: content.category,
    status: content.status,
    visibility: content.visibility,
    editorId: content.editorId,
    meta: content.meta,
    navigation: content.navigation,
    createdAt: content.createdAt,
    updatedAt: content.updatedAt,
  }));

  return {
    items: enrichedContents,
    nextToken: result.cursor || undefined,
    hasMore: !!result.cursor,
  };
}

// Types
export type { Content } from './entity';

// Schemas
export {
  CreateContentSchema,
  UpdateContentSchema,
} from './schema';
