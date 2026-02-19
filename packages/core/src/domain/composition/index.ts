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
import { notFoundError } from '../helpers';
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
  version: number;
  lastEditedBy?: string;
  mergedIntoId?: string;
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

  if (result.data.deletedAt && !result.data.mergedIntoId) {
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
    version: comp.version,
    lastEditedBy: comp.lastEditedBy,
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

  const result = await CompositionEntity.query
    .byComposer({ composerId })
    .where((attr, op) => op.notExists(attr.deletedAt))
    .go({
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
    version: composition.version,
    lastEditedBy: composition.lastEditedBy,
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

  // Transform to CompositionWithRelations, filtering out soft-deleted
  const items = (compositions.data || [])
    .filter(composition => !composition.deletedAt)
    .map(composition => ({
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
      version: composition.version,
      lastEditedBy: composition.lastEditedBy,
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

  // Transform to CompositionWithRelations, filtering out soft-deleted
  const items = (compositions.data || [])
    .filter(composition => !composition.deletedAt)
    .map(composition => ({
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
      version: composition.version,
      lastEditedBy: composition.lastEditedBy,
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

  const result = await CompositionEntity.query
    .byLanguage({ language })
    .where((attr, op) => op.notExists(attr.deletedAt))
    .go({
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
    version: composition.version,
    lastEditedBy: composition.lastEditedBy,
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

  // Handle raga relationships and denormalized data
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

    // Update denormalized raga data in composition entity
    const ragaEntities = await Promise.all(ragaIds.map(ragaId => getRaga(ragaId)));
    definedData.ragas = ragaEntities
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .map(r => ({ id: r.id, name: r.name }));
  }

  // Handle tala relationships and denormalized data
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

    // Update denormalized tala data in composition entity
    const talaEntities = await Promise.all(talaIds.map(talaId => getTala(talaId)));
    definedData.talas = talaEntities
      .filter((t): t is NonNullable<typeof t> => t !== null)
      .map(t => ({ id: t.id, name: t.name }));
  }

  // Update composition with all changes including denormalized data
  const result = await CompositionEntity.update({ id }).set(definedData).go();

  if (!result.data) {
    throw new Error(`Composition ${id} not found`);
  }

  return result.data as Composition;
}

export async function softDeleteComposition(id: string): Promise<void> {
  await CompositionEntity.update({ id }).set({ deletedAt: new Date().toISOString() }).go();
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
  const result = await CompositionEntity.query
    .byName({ title: name })
    .where((attr, op) => op.notExists(attr.deletedAt))
    .go({
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
    version: composition.version,
    lastEditedBy: composition.lastEditedBy,
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
  const result = await CompositionEntity.query
    .list({})
    .where((attr, op) => op.notExists(attr.deletedAt))
    .go({
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
    version: composition.version,
    lastEditedBy: composition.lastEditedBy,
  }));

  return {
    items: enrichedCompositions,
    nextToken: result.cursor || undefined,
    hasMore: !!result.cursor,
  };
}

export async function mergeComposition(loserId: string, canonicalId: string): Promise<void> {
  const canonical = await getComposition(canonicalId);
  if (!canonical) throw notFoundError('composition', canonicalId);
  const loser = await CompositionEntity.get({ id: loserId }).go();
  if (!loser.data) throw notFoundError('composition', loserId);

  // No cascade needed — compositions are not referenced by other entities
  await CompositionEntity.update({ id: loserId })
    .set({ deletedAt: new Date().toISOString(), mergedIntoId: canonicalId })
    .go();
}

export async function getCompositionMergeScore(id: string): Promise<number> {
  const result = await CompositionEntity.get({ id }).go();
  if (!result.data) return 0;

  let score = 0;
  if (result.data.lyricsV1 && result.data.lyricsV1.length > 0) score += 2;
  if (result.data.ragas && result.data.ragas.length > 0) score += 1;
  if (result.data.talas && result.data.talas.length > 0) score += 1;
  if (result.data.sourceAttribution) score += 1;
  return score;
}

// Types
export type { Composition } from './entity';

// Schemas
export {
  CreateCompositionSchema,
  UpdateCompositionSchema,
} from './schema';
