import type { z } from 'zod';
import { SourceEntity } from './entity';
import type { Source } from './entity';
import type { CreateSourceSchema, UpdateSourceSchema } from './schema';

export type { Source } from './entity';
export * from './schema';

export type CreateSourceInput = z.infer<typeof CreateSourceSchema>;
export type UpdateSourceInput = z.infer<typeof UpdateSourceSchema>;

export async function createSource(input: CreateSourceInput): Promise<Source> {
  const result = await SourceEntity.create(input).go();
  return result.data;
}

export async function getSource(slug: string): Promise<Source | null> {
  const result = await SourceEntity.get({ slug }).go();
  return result.data ?? null;
}

/** The sources a page cites, in one batch read. A slug that is missing is left out. */
export async function getSources(slugs: string[]): Promise<Source[]> {
  const unique = [...new Set(slugs)];
  if (unique.length === 0) return [];
  const result = await SourceEntity.get(unique.map(slug => ({ slug }))).go();
  return result.data ?? [];
}

export async function updateSource(slug: string, input: UpdateSourceInput): Promise<Source> {
  const result = await SourceEntity.patch({ slug }).set(input).go({ response: 'all_new' });
  return result.data as Source;
}

/** Every source. There are a few dozen, so one paged read covers them. */
export async function listAllSources(): Promise<Source[]> {
  const result = await SourceEntity.query.list({}).go({ pages: 'all' });
  return result.data ?? [];
}

export async function listSources(params?: { limit?: number; nextToken?: string }): Promise<{
  items: Source[];
  nextToken?: string;
  hasMore: boolean;
}> {
  const result = await SourceEntity.query
    .list({})
    .go({ limit: params?.limit ?? 100, cursor: params?.nextToken });
  return {
    items: result.data ?? [],
    nextToken: result.cursor ?? undefined,
    hasMore: !!result.cursor,
  };
}

/**
 * The source's whole state, created or replaced. What the admin CSV uses, since a sheet row
 * holds every column and a slug is the key whether or not the record exists yet.
 */
export async function putSource(input: CreateSourceInput): Promise<Source> {
  const result = await SourceEntity.put(input).go();
  return result.data as Source;
}
