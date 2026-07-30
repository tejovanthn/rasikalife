import { ArtistAffiliationEntity } from './entity';
import type { ArtistAffiliation } from './entity';
import type { AddArtistAffiliationInput } from './schema';

/**
 * Current roles first, then most recent start year, then name.
 *
 * A résumé reads newest-first, and "artistic director of Trayag Natyalaya" matters more to a
 * reader than a lecturing post that ended in 2015. Rows with no `startYear` sort last within
 * their group rather than first, because an undated row is usually a thin one.
 */
function byRecency<T extends { isCurrent?: boolean; startYear?: number }>(
  a: T,
  b: T,
  tiebreak: (a: T, b: T) => number
): number {
  if (Boolean(a.isCurrent) !== Boolean(b.isCurrent)) {
    return a.isCurrent ? -1 : 1;
  }
  const startA = a.startYear ?? Number.NEGATIVE_INFINITY;
  const startB = b.startYear ?? Number.NEGATIVE_INFINITY;
  if (startA !== startB) {
    return startB - startA;
  }
  return tiebreak(a, b);
}

export async function addArtistAffiliation(
  input: AddArtistAffiliationInput
): Promise<ArtistAffiliation> {
  // `put`, not `create` and emphatically not `upsert`. The key is the pair, so `create` throws
  // on the second attempt and a moderator correcting "faculty" to "senior faculty" hits an
  // error. `upsert` looks like the fix and is worse: it builds an UpdateExpression, and
  // ElectroDB drops undefined values out of one entirely (CLAUDE.md rule 8) — verified with
  // `.params()`, where a blank `role` produced no SET and no REMOVE. So clearing a wrong role
  // silently restored the old one, and `response: 'all_new'` echoed the stale value back into
  // the form, which reads as the UI being broken.
  //
  // A `put` is the honest verb anyway: this row *is* the pair's complete state, so there is no
  // partial-merge case to serve. It resets `createdAt` on a re-add, which nothing reads.
  const result = await ArtistAffiliationEntity.put(input).go({ response: 'all_new' });
  return result.data as ArtistAffiliation;
}

export async function removeArtistAffiliation(
  artistId: string,
  organiserId: string
): Promise<void> {
  await ArtistAffiliationEntity.delete({ artistId, organiserId }).go();
}

/** Every institution this artist is or was attached to. */
export async function getArtistAffiliations(artistId: string): Promise<ArtistAffiliation[]> {
  const result = await ArtistAffiliationEntity.query.primary({ artistId }).go({ pages: 'all' });
  const items = result.data || [];
  return [...items].sort((a, b) =>
    byRecency(a, b, (x, y) => x.organisationName.localeCompare(y.organisationName))
  );
}

/** Every artist attached to this institution — the reason this entity is a junction. */
export async function getOrganiserArtists(organiserId: string): Promise<ArtistAffiliation[]> {
  const result = await ArtistAffiliationEntity.query
    .byOrganiser({ organiserId })
    .go({ pages: 'all' });
  const items = result.data || [];
  return [...items].sort((a, b) =>
    byRecency(a, b, (x, y) => x.artistName.localeCompare(y.artistName))
  );
}

export { ArtistAffiliationEntity } from './entity';
export type { ArtistAffiliation } from './entity';
export { AddArtistAffiliationSchema } from './schema';
export type { AddArtistAffiliationInput } from './schema';
