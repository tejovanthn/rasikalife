import { generateId } from '../../utils';
import { CompositionEntity } from './entity';
import type { Composition } from './entity';
import type { z } from 'zod';
import type { CreateCompositionSchema, UpdateCompositionSchema } from './schema';
import {
  createCompositionRaga,
  deleteCompositionRaga,
  getCompositionRagas,
  getCompositionsByRaga,
} from '../composition_raga';
import {
  createCompositionTala,
  deleteCompositionTala,
  getCompositionTalas,
  getCompositionsByTala,
} from '../composition_tala';
import { getArtist } from '../artist';
import { getRaga } from '../raga';
import { getTala } from '../tala';

export type CreateCompositionInput = z.infer<typeof CreateCompositionSchema>;
export type UpdateCompositionInput = z.infer<typeof UpdateCompositionSchema>;

export interface CompositionWithRelations {
  id: string;
  title: string;
  artistId: string;
  artistName: string;
  ragas: Array<{ id: string; name: string }>;
  talas: Array<{ id: string; name: string }>;
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
  const { ragaIds = [], talaIds = [], ...data } = input;

  // Fetch related entities for denormalization
  const [artist, nameMaps] = await Promise.all([
    getArtist(data.artistId),
    createNameMaps(ragaIds, talaIds),
  ]);

  if (!artist) throw new Error('Artist not found');

  const result = await CompositionEntity.create({
    id: generateId(),
    title: data.title,
    artistId: data.artistId,
    artistName: artist.name,
    ragas: nameMaps.ragas,
    talas: nameMaps.talas,
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
  if (!result.data) return null;

  const comp = result.data;
  return {
    id: comp.id,
    title: comp.title,
    artistId: comp.artistId,
    artistName: comp.artistName,
    ragas: comp.ragas || [],
    talas: comp.talas || [],
    createdAt: comp.createdAt,
    updatedAt: comp.updatedAt,
  };
}

export async function getCompositionsByArtist(
  artistId: string
): Promise<CompositionWithRelations[]> {
  const result = await CompositionEntity.query.byArtist({ artistId }).go();
  const compositions = result.data || [];

  // Get relations for each composition in parallel
  const compositionsWithRelations = await Promise.all(
    compositions.map(async composition => {
      return {
        id: composition.id,
        title: composition.title,
        artistId: composition.artistId,
        artistName: composition.artistName,
        ragas: composition.ragas || [],
        talas: composition.talas || [],
        createdAt: composition.createdAt,
        updatedAt: composition.updatedAt,
      };
    })
  );

  return compositionsWithRelations;
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

  const result = await CompositionEntity.update({ id }).set(definedData).go();

  if (!result.data) {
    throw new Error(`Composition ${id} not found`);
  }

  // Handle raga relationships
  if (ragaIds !== undefined) {
    // Delete existing raga relationships
    const existingRagas = await getCompositionRagas(id);
    await Promise.all(existingRagas.map(raga => deleteCompositionRaga(id, raga.ragaId)));

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
    await Promise.all(existingTalas.map(tala => deleteCompositionTala(id, tala.talaId)));

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
    ...existingRagas.map(raga => deleteCompositionRaga(id, raga.ragaId)),
    ...existingTalas.map(tala => deleteCompositionTala(id, tala.talaId)),
  ]);

  // Delete the composition
  await CompositionEntity.delete({ id }).go();
}

export async function listCompositions(params?: { limit?: number; nextToken?: string }): Promise<{
  items: CompositionWithRelations[];
  nextToken?: string;
  hasMore: boolean;
}> {
  const limit = params?.limit || 20;
  const result = await CompositionEntity.scan.go({
    limit,
    cursor: params?.nextToken,
  });

  // For each composition, we need to enrich it with relations
  const enrichedCompositions = await Promise.all(
    (result.data || []).map(composition => ({
      id: composition.id,
      title: composition.title,
      artistId: composition.artistId,
      artistName: composition.artistName,
      ragas: composition.ragas || [],
      talas: composition.talas || [],
      createdAt: composition.createdAt,
      updatedAt: composition.updatedAt,
    }))
  );

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
