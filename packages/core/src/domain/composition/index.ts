import { ApplicationError, ErrorCode } from '@rasika/core';
import type { z } from 'zod';
import { generateId } from '../../utils';
import { getArtist } from '../artist';
import {
  createCompositionRaga,
  deleteCompositionRaga,
  getCompositionRagas,
  getCompositionsByRaga as getRagaJunctionRecords,
} from '../composition_raga';
import {
  createCompositionTala,
  deleteCompositionTala,
  getCompositionTalas,
  getCompositionsByTala as getTalaJunctionRecords,
} from '../composition_tala';
import { getRaga } from '../raga';
import { getTala } from '../tala';
import { CompositionEntity } from './entity';
import type { Composition } from './entity';
import type { CreateCompositionSchema, UpdateCompositionSchema } from './schema';

export type CreateCompositionInput = z.infer<typeof CreateCompositionSchema>;
export type UpdateCompositionInput = z.infer<typeof UpdateCompositionSchema>;

// Alias for backward compatibility during transition
export type Lyrics = Array<{
  type: string;
  order: number;
  text: string;
  number?: number;
  ragaName?: string;
}>;

export interface CompositionWithRelations {
  id: string;
  title: string;
  composer: { id: string; name: string };
  language: string;
  lyricsV1: Array<{
    type: string;
    order: number;
    text: string;
    number?: number;
    ragaName?: string;
  }>;
  ragas: Array<{ id: string; name: string }>;
  talas: Array<{ id: string; name: string }>;
  sourceAttribution?: string;
  createdAt: string;
  updatedAt: string;
}

// Generic junction creation helper (addresses DHH duplication feedback)
async function createJunctionRecords<T>(
  records: T[],
  createFn: (record: T) => Promise<unknown>
): Promise<void> {
  if (records?.length > 0) {
    await Promise.all(records.map(createFn));
  }
}

// Convert ID arrays to name maps for denormalization
async function createNameMaps(
  ragaIds: string[],
  talaIds: string[]
): Promise<{
  ragas: Array<{ id: string; name: string }>;
  talas: Array<{ id: string; name: string }>;
}> {
  const [ragas, talas] = await Promise.all([
    Promise.all(ragaIds.map(id => getRaga(id))),
    Promise.all(talaIds.map(id => getTala(id))),
  ]);

  return {
    ragas: ragas
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .map(r => ({ id: r.id, name: r.name })),
    talas: talas
      .filter((t): t is NonNullable<typeof t> => t !== null)
      .map(t => ({ id: t.id, name: t.name })),
  };
}

export async function createComposition(input: CreateCompositionInput): Promise<Composition> {
  const { ragaIds = [], talaIds = [], sourceAttribution, ...data } = input;

  // Fetch related entities for denormalization
  const nameMaps = await createNameMaps(ragaIds, talaIds);

  const result = await CompositionEntity.create({
    id: generateId(),
    title: data.title,
    composerId: data.composer.id,
    composer: data.composer,
    language: data.language,
    lyricsV1: data.lyricsV1 || [],
    ragas: nameMaps.ragas,
    talas: nameMaps.talas,
    sourceAttribution,
  }).go();

  if (!result.data) throw new Error('Failed to create composition');

  // Create junction records for reverse lookups
  await Promise.all([
    createJunctionRecords(ragaIds, (ragaId: string) =>
      createCompositionRaga({ compositionId: result.data.id, ragaId })
    ),
    createJunctionRecords(talaIds, (talaId: string) =>
      createCompositionTala({ compositionId: result.data.id, talaId })
    ),
  ]);

  return result.data;
}

// Single efficient query (addresses N+1 feedback)
export async function getComposition(id: string): Promise<CompositionWithRelations | null> {
  const result = await CompositionEntity.get({ id }).go();
  if (!result.data) {
    return null;
  }

  const comp = result.data;
  return {
    id: comp.id,
    title: comp.title,
    composer: comp.composer,
    language: comp.language,
    lyricsV1: comp.lyricsV1 || [],
    ragas: comp.ragas || [],
    talas: comp.talas || [],
    sourceAttribution: comp.sourceAttribution,
    createdAt: comp.createdAt,
    updatedAt: comp.updatedAt,
  };
}

export async function getCompositionsByComposer(
  composerId: string,
  params?: { limit?: number; nextToken?: string }
): Promise<{
  items: CompositionWithRelations[];
  nextToken?: string;
  hasMore: boolean;
}> {
  const limit = params?.limit || 20;

  const result = await CompositionEntity.query.byComposer({ composerId }).go({
    limit,
    cursor: params?.nextToken,
  });
  const compositions = result.data || [];

  // Transform to CompositionWithRelations
  const items = compositions.map(composition => ({
    id: composition.id,
    title: composition.title,
    composer: composition.composer,
    language: composition.language,
    lyricsV1: composition.lyricsV1 || [],
    ragas: composition.ragas || [],
    talas: composition.talas || [],
    sourceAttribution: composition.sourceAttribution,
    createdAt: composition.createdAt,
    updatedAt: composition.updatedAt,
  }));

  return {
    items,
    nextToken: result.cursor || undefined,
    hasMore: !!result.cursor,
  };
}

export async function getCompositionsByRaga(
  ragaId: string,
  params?: { limit?: number; nextToken?: string }
): Promise<{
  items: CompositionWithRelations[];
  nextToken?: string;
  hasMore: boolean;
}> {
  const limit = params?.limit || 20;

  const junctionResult = await getRagaJunctionRecords(ragaId, {
    limit,
    nextToken: params?.nextToken,
  });

  if (!junctionResult.items?.length) {
    return { items: [], hasMore: false };
  }

  // Batch fetch full compositions
  const compositionIds = junctionResult.items.map(j => ({ id: j.compositionId }));
  const compositions = await CompositionEntity.get(compositionIds).go();

  // Transform to CompositionWithRelations
  const items = (compositions.data || []).map(composition => ({
    id: composition.id,
    title: composition.title,
    composer: composition.composer,
    language: composition.language,
    lyricsV1: composition.lyricsV1 || [],
    ragas: composition.ragas || [],
    talas: composition.talas || [],
    sourceAttribution: composition.sourceAttribution,
    createdAt: composition.createdAt,
    updatedAt: composition.updatedAt,
  }));

  return {
    items,
    nextToken: junctionResult.nextToken,
    hasMore: junctionResult.hasMore,
  };
}

export async function getCompositionsByTala(
  talaId: string,
  params?: { limit?: number; nextToken?: string }
): Promise<{
  items: CompositionWithRelations[];
  nextToken?: string;
  hasMore: boolean;
}> {
  const limit = params?.limit || 20;

  const junctionResult = await getTalaJunctionRecords(talaId, {
    limit,
    nextToken: params?.nextToken,
  });

  if (!junctionResult.items?.length) {
    return { items: [], hasMore: false };
  }

  // Batch fetch full compositions
  const compositionIds = junctionResult.items.map(j => ({ id: j.compositionId }));
  const compositions = await CompositionEntity.get(compositionIds).go();

  // Transform to CompositionWithRelations
  const items = (compositions.data || []).map(composition => ({
    id: composition.id,
    title: composition.title,
    composer: composition.composer,
    language: composition.language,
    lyricsV1: composition.lyricsV1 || [],
    ragas: composition.ragas || [],
    talas: composition.talas || [],
    sourceAttribution: composition.sourceAttribution,
    createdAt: composition.createdAt,
    updatedAt: composition.updatedAt,
  }));

  return {
    items,
    nextToken: junctionResult.nextToken,
    hasMore: junctionResult.hasMore,
  };
}

export async function getCompositionsByLanguage(
  language: string,
  params?: { limit?: number; nextToken?: string }
): Promise<{
  items: CompositionWithRelations[];
  nextToken?: string;
  hasMore: boolean;
}> {
  const limit = params?.limit || 20;

  const result = await CompositionEntity.query.byLanguage({ language }).go({
    limit,
    cursor: params?.nextToken,
  });

  const compositions = result.data || [];

  // Transform to CompositionWithRelations
  const items = compositions.map(composition => ({
    id: composition.id,
    title: composition.title,
    composer: composition.composer,
    language: composition.language,
    lyricsV1: composition.lyricsV1 || [],
    ragas: composition.ragas || [],
    talas: composition.talas || [],
    sourceAttribution: composition.sourceAttribution,
    createdAt: composition.createdAt,
    updatedAt: composition.updatedAt,
  }));

  return {
    items,
    nextToken: result.cursor || undefined,
    hasMore: !!result.cursor,
  };
}

export async function updateComposition(
  id: string,
  input: UpdateCompositionInput
): Promise<Composition> {
  const { ragaIds, talaIds, ...compositionData } = input;

  // Filter out undefined values
  const definedData = Object.fromEntries(
    Object.entries(compositionData).filter(([_, value]) => value !== undefined)
  );

  // Update composerId if composer is being updated
  if (input.composer) {
    definedData.composerId = input.composer.id;
  }

  const result = await CompositionEntity.update({ id }).set(definedData).go();

  if (!result.data) {
    throw new Error(`Composition ${id} not found`);
  }

  // Handle raga relationships
  if (ragaIds !== undefined) {
    // Delete existing raga relationships
    const existingRagas = await getCompositionRagas(id);
    await Promise.all(existingRagas.items.map(raga => deleteCompositionRaga(id, raga.ragaId)));

    // Create new raga relationships
    if (ragaIds.length > 0) {
      await Promise.all(
        ragaIds.map(ragaId =>
          createCompositionRaga({
            compositionId: id,
            ragaId,
          })
        )
      );
    }
  }

  // Handle tala relationships
  if (talaIds !== undefined) {
    // Delete existing tala relationships
    const existingTalas = await getCompositionTalas(id);
    await Promise.all(existingTalas.items.map(tala => deleteCompositionTala(id, tala.talaId)));

    // Create new tala relationships
    if (talaIds.length > 0) {
      await Promise.all(
        talaIds.map(talaId =>
          createCompositionTala({
            compositionId: id,
            talaId,
          })
        )
      );
    }
  }

  return result.data as Composition;
}

export async function deleteComposition(id: string): Promise<void> {
  // Delete junction table records first
  const [existingRagas, existingTalas] = await Promise.all([
    getCompositionRagas(id),
    getCompositionTalas(id),
  ]);

  await Promise.all([
    ...existingRagas.items.map(raga => deleteCompositionRaga(id, raga.ragaId)),
    ...existingTalas.items.map(tala => deleteCompositionTala(id, tala.talaId)),
  ]);

  // Delete composition
  await CompositionEntity.delete({ id }).go();
}

export async function getCompositionsByName(name: string): Promise<CompositionWithRelations[]> {
  // Explicitly set a high limit to ensure all matching compositions are returned
  const result = await CompositionEntity.query.byName({ title: name }).go({
    limit: 1000, // High limit to get all matching compositions
  });
  const compositions = result.data || [];

  const compositionsWithRelations = compositions.map(composition => ({
    id: composition.id,
    title: composition.title,
    composer: composition.composer,
    language: composition.language,
    lyricsV1: composition.lyricsV1 || [],
    ragas: composition.ragas || [],
    talas: composition.talas || [],
    sourceAttribution: composition.sourceAttribution,
    createdAt: composition.createdAt,
    updatedAt: composition.updatedAt,
  }));

  return compositionsWithRelations;
}

export async function listCompositions(params?: { limit?: number; nextToken?: string }): Promise<{
  items: CompositionWithRelations[];
  nextToken?: string;
  hasMore: boolean;
}> {
  const limit = params?.limit || 20;

  // Query the list index for efficient sorted retrieval
  const result = await CompositionEntity.query.list({}).go({
    limit,
    cursor: params?.nextToken,
  });

  // For each composition, we need to enrich it with relations
  const enrichedCompositions = (result.data || []).map(composition => ({
    id: composition.id,
    title: composition.title,
    composer: composition.composer,
    language: composition.language,
    lyricsV1: composition.lyricsV1 || [],
    ragas: composition.ragas || [],
    talas: composition.talas || [],
    sourceAttribution: composition.sourceAttribution,
    createdAt: composition.createdAt,
    updatedAt: composition.updatedAt,
  }));

  return {
    items: enrichedCompositions,
    nextToken: result.cursor || undefined,
    hasMore: !!result.cursor,
  };
}

// Types
export type { Composition } from './entity';

// Schemas
export {
  CreateCompositionSchema,
  UpdateCompositionSchema,
} from './schema';
