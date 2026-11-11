import { ArtistEntity } from '../artist/entity';
import { OrganiserEntity } from '../organiser/entity';
import { VenueEntity } from '../venue/entity';
import type { FollowTargetType } from './schema';

export type ResolvedTarget = { type: FollowTargetType; id: string; name: string };

const MAX_MERGE_HOPS = 5;

type TargetRow = { id: string; name: string; deletedAt?: string; mergedIntoId?: string };

async function readTarget(type: FollowTargetType, id: string): Promise<TargetRow | null> {
  const result =
    type === 'venue'
      ? await VenueEntity.get({ id }).go()
      : type === 'organiser'
        ? await OrganiserEntity.get({ id }).go()
        : await ArtistEntity.get({ id }).go();
  return (result.data as TargetRow | null) ?? null;
}

/**
 * The live record a follow should point at: the target itself, or where a merge sent it.
 * A missing or soft-deleted record with no merge pointer resolves to `null`.
 */
export async function resolveFollowTarget(
  type: FollowTargetType,
  id: string
): Promise<ResolvedTarget | null> {
  let currentId = id;
  for (let hop = 0; hop <= MAX_MERGE_HOPS; hop++) {
    const row = await readTarget(type, currentId);
    if (!row) return null;
    if (row.mergedIntoId) {
      currentId = row.mergedIntoId;
      continue;
    }
    if (row.deletedAt) return null;
    return { type, id: row.id, name: row.name };
  }
  return null;
}
