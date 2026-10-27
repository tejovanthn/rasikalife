import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { z } from 'zod';
import { TABLE_NAME, dynamoClient } from '../../db/client';
import { keyOfEntity } from '../../db/keys';
import { generateId } from '../../utils';
import { cascadeRagaMerge, cascadeRagaNameUpdate } from '../cascade';
import { createFailedError, notFoundError } from '../helpers';
import { mergeFillPatch } from './dedup';
import { RagaEntity } from './entity';
import type { Raga } from './entity';
import type { CreateRagaSchema, UpdateRagaSchema } from './schema';
import { CITABLE_RAGA_FIELDS, type Citation, pruneCitations } from './sourced';

export type CreateRagaInput = z.infer<typeof CreateRagaSchema>;
export type UpdateRagaInput = z.infer<typeof UpdateRagaSchema>;

export async function createRaga(input: CreateRagaInput): Promise<Raga> {
  const id = generateId();
  const result = await RagaEntity.create({
    id,
    ...input,
  }).go();

  if (!result.data) {
    throw createFailedError('raga', input.name);
  }

  return result.data as Raga;
}

export async function getRaga(id: string): Promise<Raga | null> {
  const result = await RagaEntity.get({ id }).go();
  if (!result.data) {
    return null;
  }
  if (result.data.deletedAt && !result.data.mergedIntoId) {
    return null;
  }
  return result.data as Raga;
}

export async function getRagaByName(name: string): Promise<Raga | null> {
  const result = await RagaEntity.query.byName({ name }).go();
  return (result.data?.[0] as Raga) || null;
}

export async function updateRaga(id: string, input: UpdateRagaInput): Promise<Raga> {
  // Read once, and only when something below needs the stored record: the citation prune, or
  // the rename check.
  const needsStored =
    !!input.name || CITABLE_RAGA_FIELDS.some(f => f in input) || 'citations' in input;
  const stored = needsStored ? (await RagaEntity.get({ id }).go()).data : null;

  const result = await RagaEntity.update({ id }).set(withPrunedCitations(stored, input)).go();

  if (!result.data) {
    throw notFoundError('raga', id);
  }

  // A cascade fires on a real change, not on a field being present. Every row of an exported
  // raga sheet carries `name`, so a bulk import used to rewrite every composition and junction
  // naming each raga with the value it already held (the artist importer's eight-hour lesson).
  if (input.name && input.name !== stored?.name) {
    await cascadeRagaNameUpdate(id, input.name);
  }

  return result.data as Raga;
}

/**
 * A citation for a field the update empties claims nothing, so it goes with the value.
 */
function withPrunedCitations(
  stored: Record<string, unknown> | null,
  input: UpdateRagaInput
): UpdateRagaInput {
  const touches = CITABLE_RAGA_FIELDS.some(f => f in input) || 'citations' in input;
  if (!touches) return input;
  const merged = { ...stored, ...input } as Record<string, unknown> & {
    citations?: Citation[];
  };
  const pruned = pruneCitations(merged);
  if (pruned.length === (merged.citations ?? []).length && !('citations' in input)) return input;
  return { ...input, citations: pruned };
}

export async function deleteRaga(id: string): Promise<void> {
  await RagaEntity.delete({ id }).go();
}

export async function softDeleteRaga(id: string): Promise<void> {
  await RagaEntity.update({ id }).set({ deletedAt: new Date().toISOString() }).go();
}

export async function listRagas(params?: { limit?: number; nextToken?: string }): Promise<{
  items: Raga[];
  nextToken?: string;
  hasMore: boolean;
}> {
  const limit = params?.limit || 20;

  // Query the list index for efficient sorted retrieval
  const result = await RagaEntity.query
    .list({})
    .where((attr, op) => op.notExists(attr.deletedAt))
    .go({
      limit,
      cursor: params?.nextToken,
    });

  return {
    items: result.data || [],
    nextToken: result.cursor || undefined,
    hasMore: !!result.cursor,
  };
}

export async function getRagasByMelaNumber(
  melaNumber: number,
  excludeId?: string
): Promise<Raga[]> {
  const result = await RagaEntity.query
    .list({})
    .where((attr, op) => op.eq(attr.melaNumber, melaNumber))
    .go({ limit: 50 });

  return (result.data || []).filter(r => !r.deletedAt && r.id !== excludeId) as Raga[];
}

/**
 * Live ragas whose parent is `parentId`. There is no index on the parent, so
 * this pages through every raga; it runs only on a merge, about 1,500 rows.
 */
export async function listJanyaOf(parentId: string): Promise<Raga[]> {
  const children: Raga[] = [];
  let nextToken: string | undefined;
  do {
    const page = await listRagas({ limit: 500, nextToken });
    children.push(...page.items.filter(r => r.parentRaga?.id === parentId));
    nextToken = page.nextToken;
  } while (nextToken);
  return children;
}

export async function mergeRaga(loserId: string, canonicalId: string): Promise<void> {
  const canonical = await getRaga(canonicalId);
  if (!canonical) throw notFoundError('raga', canonicalId);
  const loser = await RagaEntity.get({ id: loserId }).go();
  if (!loser.data) throw notFoundError('raga', loserId);

  await cascadeRagaMerge(loserId, canonicalId, canonical.name);

  // The survivor can be the barer record; keep the loser's facts visible.
  const patch = mergeFillPatch(canonical, loser.data);
  if (Object.keys(patch).length > 0) {
    await RagaEntity.update({ id: canonicalId })
      .set(patch as never)
      .go();
  }

  // Janya ragas name their parent by id; point them at the survivor.
  for (const child of await listJanyaOf(loserId)) {
    await RagaEntity.update({ id: child.id })
      .set({ parentRaga: { id: canonicalId, name: canonical.name } })
      .go();
  }

  await RagaEntity.update({ id: loserId })
    .set({ deletedAt: new Date().toISOString(), mergedIntoId: canonicalId })
    .go();
}

/** Composition ids linked to a raga through the junction, every page. */
export async function listRagaCompositionIds(id: string): Promise<string[]> {
  const { CompositionRagaEntity } = await import('../composition_raga/entity');
  const ids: string[] = [];
  let cursor: string | null = null;
  do {
    const result = (await CompositionRagaEntity.query
      .byRaga({ ragaId: id })
      .go({ cursor, attributes: ['compositionId'] as never[] })) as {
      data: Array<{ compositionId: string }>;
      cursor: string | null;
    };
    ids.push(...(result.data ?? []).map(r => r.compositionId));
    cursor = result.cursor;
  } while (cursor);
  return ids;
}

/** Concert-log performances logged against a raga. */
export async function countRagaPerformances(id: string): Promise<number> {
  const { listPerformancesByRaga } = await import('../concert-log-item');
  let count = 0;
  let nextToken: string | undefined;
  do {
    const page = await listPerformancesByRaga(id, { limit: 100, nextToken });
    count += page.items.length;
    nextToken = page.nextToken;
  } while (nextToken);
  return count;
}

/**
 * Everything `mergeRaga(loserId, canonicalId)` would touch, read without
 * writing. The dedup CLI prints this for `--dry-run` and saves it beside a real
 * run, which is the only record from which a merge could be undone by hand.
 */
export async function previewRagaMerge(loserId: string, canonicalId: string) {
  const [loser, canonical, loserCompositions, canonicalCompositions, loserPerformances] =
    await Promise.all([
      RagaEntity.get({ id: loserId }).go(),
      RagaEntity.get({ id: canonicalId }).go(),
      listRagaCompositionIds(loserId),
      listRagaCompositionIds(canonicalId),
      countRagaPerformances(loserId),
    ]);
  const onCanonical = new Set(canonicalCompositions);
  const children = await listJanyaOf(loserId);
  return {
    loser: loser.data ?? null,
    canonical: canonical.data ?? null,
    /** Blank survivor fields filled from the loser. */
    fillPatch: loser.data && canonical.data ? mergeFillPatch(canonical.data, loser.data) : {},
    /** Janya ragas re-pointed from the loser to the survivor. */
    children: children.map(c => c.name),
    /** Junctions re-pointed from the loser to the canonical raga. */
    compositionsMoved: loserCompositions.filter(c => !onCanonical.has(c)),
    /** Compositions already linked to both; the loser junction is only deleted. */
    compositionsAlreadyOnCanonical: loserCompositions.filter(c => onCanonical.has(c)),
    /** `mergeRaga` does not move these; they keep pointing at the loser. */
    loserPerformances,
  };
}

export async function getRagaMergeScore(id: string): Promise<number> {
  const { CompositionRagaEntity } = await import('../composition_raga/entity');

  const result = await CompositionRagaEntity.query
    .byRaga({ ragaId: id })
    .go({ attributes: ['compositionId'] as never[] });

  return (result.data || []).length;
}

export async function adjustPerformanceCount(ragaId: string, delta: number): Promise<void> {
  await dynamoClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      // ElectroDB lowercases composite key values, so the key must be derived from
      // the entity rather than hand-built in uppercase, or this writes a phantom row.
      Key: keyOfEntity(RagaEntity, { id: ragaId }),
      UpdateExpression: 'ADD performanceCount :delta',
      ExpressionAttributeValues: { ':delta': delta },
    })
  );
}

/** Written only by `search-volume-import`; a patch, so a deleted id fails rather than creating. */
export async function setRagaSearchVolume(
  id: string,
  searchVolume: number,
  checkedAt: string
): Promise<void> {
  await RagaEntity.patch({ id }).set({ searchVolume, searchVolumeCheckedAt: checkedAt }).go();
}

export type { Raga } from './entity';
// Matching keys for the dedup CLI in packages/scripts, which cannot host its own
// tests — keeping them here is what makes the matching testable.
export { ragaExactKey, ragaVariantKey } from './dedup';
// The 72-melakarta generating rules, shared by the chakra widget and the script
// that resolves the canonical melakarta records in the database.
export {
  CHAKRA_NAMES,
  chakraNameOfMela,
  chakraOfMela,
  melakartaScale,
  positionOfMela,
} from './melakarta';
export type { ChakraName } from './melakarta';
export { CreateRagaSchema, UpdateRagaSchema } from './schema';
// Citations, notation and relatives are pure and also reachable from `./client`.
export * from './sourced';
export * from './notation';
export * from './relatives';
export { SCALE_TYPES, PrayogaSchema, type Prayoga } from './schema';
