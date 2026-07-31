import type { z } from 'zod';
import { generateId } from '../../utils';
import {
  cascadeArtistDeleteToAffiliations,
  cascadeArtistDeleteToMemberships,
  cascadeArtistMerge,
  cascadeArtistNameUpdate,
} from '../cascade';
import { createFailedError, notFoundError } from '../helpers';
import { ArtistEntity } from './entity';
import type { Artist } from './entity';
import { CLEARABLE_ARTIST_FIELDS } from './schema';
import type { CreateArtistSchema, UpdateArtistSchema } from './schema';

export type CreateArtistInput = z.infer<typeof CreateArtistSchema>;
export type UpdateArtistInput = z.infer<typeof UpdateArtistSchema>;

export async function createArtist(input: CreateArtistInput): Promise<Artist> {
  const id = generateId();
  const result = await ArtistEntity.create({
    id,
    ...input,
  }).go();

  if (!result.data) {
    throw createFailedError('artist', input.name);
  }

  return result.data as Artist;
}

export async function getArtist(id: string): Promise<Artist | null> {
  const result = await ArtistEntity.get({ id }).go();

  if (!result.data) {
    return null;
  }

  if (result.data.deletedAt && !result.data.mergedIntoId) {
    return null;
  }

  return result.data as Artist;
}

export async function getArtistByName(name: string): Promise<Artist | null> {
  const result = await ArtistEntity.query.byName({ name }).go();
  const artist = result.data?.[0];
  if (!artist) return null;
  if (artist.deletedAt && !artist.mergedIntoId) return null;
  if (artist.mergedIntoId) return getArtist(artist.mergedIntoId);
  return artist as Artist;
}

/**
 * `clearFields` names attributes to remove outright, which is the only way to empty an
 * optional field. Passing a value cannot express it: `website` is validated with `.url()` so
 * `''` fails the schema, and writing `''` where it would pass leaves the row claiming the
 * field exists and is blank, so anything testing `!== undefined` disagrees with the page.
 *
 * Filtered against CLEARABLE_ARTIST_FIELDS rather than trusted, because the list arrives from
 * a request: without it, `clearFields: ['name']` would strip the one attribute every read
 * path and every merge depends on.
 */
export async function updateArtist(
  id: string,
  input: UpdateArtistInput,
  clearFields?: readonly string[]
): Promise<Artist> {
  const allowed = new Set<string>(CLEARABLE_ARTIST_FIELDS);
  // Never remove something the same call is also setting: a field the moderator filled in
  // should not be wiped because it was blank a moment earlier.
  const toClear = (clearFields ?? []).filter(
    field => allowed.has(field) && (input as Record<string, unknown>)[field] === undefined
  );

  const operation = ArtistEntity.update({ id }).set(input);
  const result = await (toClear.length > 0
    ? operation.remove([...toClear] as Parameters<typeof operation.remove>[0])
    : operation
  ).go();

  if (!result.data) {
    throw notFoundError('artist', id);
  }

  if (input.name) {
    await cascadeArtistNameUpdate(id, input.name);
  }

  return result.data as Artist;
}

/**
 * Stores the generated media kit on the record.
 *
 * Its own function rather than a field on `updateArtist`, for the same reason `claimStatus` has
 * one: `mediaKit` is outside `CreateArtistSchema`, so no form, no CSV import and no claimant
 * edit can reach it. Only this writes it.
 *
 * `patch` rather than `update` so it carries the existence condition — a media kit must never
 * bring a record into being, which is the phantom-row failure this codebase has already repaired
 * in production once.
 */
export async function setArtistMediaKit(
  id: string,
  mediaKit: { short: string; long: string; factsHash: string; generatedAt: string }
): Promise<void> {
  await ArtistEntity.patch({ id }).set({ mediaKit }).go();
}

export async function softDeleteArtist(id: string): Promise<void> {
  await ArtistEntity.update({ id }).set({ deletedAt: new Date().toISOString() }).go();
  // Membership edges are dropped, not hidden. A deleted artist should stop
  // appearing in its groups' member lists, and a deleted group should stop
  // claiming members — neither read path filters on the artist's deletedAt,
  // because doing so would cost a lookup per row and defeat the single-query
  // design the junction exists for. Note this makes the delete one-way for
  // memberships even though the artist row itself is only soft-deleted.
  await cascadeArtistDeleteToMemberships(id);
  // Affiliation edges go for exactly the same reason, on the same terms.
  await cascadeArtistDeleteToAffiliations(id);
}

export async function listArtists(params?: { limit?: number; nextToken?: string }): Promise<{
  items: Artist[];
  nextToken?: string;
  hasMore: boolean;
}> {
  const limit = params?.limit || 20;

  // Unlisted records are excluded here rather than at each call site, which is what keeps
  // photographers out of both the artist index and the search corpus: the indexer reads this
  // same function.
  const result = await ArtistEntity.query
    .list({})
    .where((attr, op) => `${op.notExists(attr.deletedAt)} AND ${op.ne(attr.unlisted, true)}`)
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

export async function mergeArtist(loserId: string, canonicalId: string): Promise<void> {
  const canonical = await getArtist(canonicalId);
  if (!canonical) throw notFoundError('artist', canonicalId);
  const loser = await ArtistEntity.get({ id: loserId }).go();
  if (!loser.data) throw notFoundError('artist', loserId);

  await cascadeArtistMerge(loserId, canonicalId, canonical.name);
  await ArtistEntity.update({ id: loserId })
    .set({ deletedAt: new Date().toISOString(), mergedIntoId: canonicalId })
    .go();

  const loserName = loser.data.name;
  const existing = (canonical.alternateNames || []) as string[];
  if (!existing.includes(loserName)) {
    await ArtistEntity.update({ id: canonicalId })
      .set({ alternateNames: [...existing, loserName] })
      .go();
  }

  await rebuildCollaboratorsAfterMerge(loserId, canonicalId);
}

/**
 * Repair collaborator lists once a merge has moved the loser's events.
 *
 * Anyone still naming the loser as a collaborator is, by definition, someone who
 * shared an event with it — and those events now belong to the canonical artist.
 * So rebuilding the canonical and then everyone it collaborates with reaches
 * every stale reference without scanning the table.
 *
 * The loser's own list is left as-is: the record is soft-deleted and every read
 * path redirects through `mergedIntoId`, so nothing renders it.
 */
async function rebuildCollaboratorsAfterMerge(loserId: string, canonicalId: string): Promise<void> {
  const { rebuildArtistCollaborators, COLLABORATOR_MERGE_FANOUT_CAP } = await import(
    './collaborators'
  );
  // Use the list the rebuild just computed. Re-reading through getArtist here would
  // be eventually consistent and could hand back the pre-merge neighbours, leaving
  // the loser's former co-artists — the ones still naming the merged-away artist —
  // untouched.
  const canonicalCollaborators = await rebuildArtistCollaborators(canonicalId);
  const affected = canonicalCollaborators
    .map(c => c.artistId)
    .filter(id => id !== loserId && id !== canonicalId);

  // Each rebuild walks that artist's whole event history, so a merge of two
  // busy performers can fan out to hundreds. Merges run inside a moderator
  // request, so cap it and leave the rest to the backfill rather than risk
  // throttling the table — a failure here is swallowed and would be invisible.
  if (affected.length > COLLABORATOR_MERGE_FANOUT_CAP) {
    console.warn(
      `Merge touched ${affected.length} collaborators (cap ${COLLABORATOR_MERGE_FANOUT_CAP}); their lists may name the merged-away artist until: pnpm cli rebuild-collaborators`
    );
    return;
  }

  const results = await Promise.allSettled(affected.map(rebuildArtistCollaborators));
  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      console.error(`Failed to rebuild collaborators for artist ${affected[i]}:`, result.reason);
    }
  });
}

export async function getArtistMergeScore(id: string): Promise<number> {
  const { EventArtistEntity } = await import('../event-artist/entity');
  const { CompositionEntity } = await import('../composition/entity');

  const [eventResult, compResult, artist] = await Promise.all([
    EventArtistEntity.query.byArtist({ artistId: id }).go({ attributes: ['artistId'] as never[] }),
    CompositionEntity.query.byComposer({ composerId: id }).go({ attributes: ['id'] as never[] }),
    ArtistEntity.get({ id }).go(),
  ]);

  let score = (eventResult.data || []).length + (compResult.data || []).length;
  if (artist.data) {
    if (artist.data.title) score += 1;
    if (artist.data.gurus && artist.data.gurus.length > 0) score += 1;
    if (artist.data.biography) score += 2;
    if (artist.data.specialisations && artist.data.specialisations.length > 0) score += 1;
    if (artist.data.birthYear) score += 1;
  }
  return score;
}

export type { Artist } from './entity';
export {
  CLAIMANT_EDITABLE_ARTIST_FIELDS,
  CLEARABLE_ARTIST_FIELDS,
  CreateArtistSchema,
  UpdateArtistSchema,
  isClaimantEditablePatch,
} from './schema';
export {
  artistNameSimilarity,
  findArtistMatch,
  findOrCreateArtist,
  initialsMatch,
  listAllArtistsForMatching,
  normalizeArtistName,
  rankArtistSearchResults,
} from './dedup';

// collaboratorsFrom is exported because the full-table sweep in packages/scripts imports it
// to build every artist's list from one pass over the junction. It was missing here, so
// `pnpm cli rebuild-collaborators` completed both scans and then died on `undefined`.
export { collaboratorsFrom, rebuildArtistCollaborators } from './collaborators';
export { computeRepertoire } from './repertoire';
export type { Repertoire, RepertoireSetlistRow } from './repertoire';
export { rebuildAllRepertoires, rebuildArtistRepertoire } from './repertoire-sweep';
export type { RepertoireSweepResult } from './repertoire-sweep';
export { rebuildAllFeatured } from './featured-sweep';
export type { FeaturedSweepResult } from './featured-sweep';
export { buildCollaboratorLists, rebuildAllCollaborators } from './collaborators-sweep';
export type { CollaboratorSweepResult } from './collaborators-sweep';
