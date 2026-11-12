import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { TABLE_NAME, dynamoClient } from '../../db/client';
import { invalidateSitePaths } from '../../site-cache';
import type { FollowTargetType } from './schema';
import { resolveFollowTarget } from './target';

/**
 * Follows move `followerCount`, which the venue, organiser and artist pages show. They do not
 * purge `/*` (a concert with hundreds of QR follows would purge hundreds of times). They purge
 * only the followed page, at most once per `FOLLOW_PURGE_WINDOW_MS` per target, so the public
 * count lags by at most that long.
 */
export const FOLLOW_PURGE_WINDOW_MS = 30 * 60 * 1000;

const SEGMENT: Record<FollowTargetType, string> = {
  venue: 'venues',
  organiser: 'organisers',
  artist: 'artists',
};

/** The same slug the web app builds for a page URL (`generateSlug` in web `lib/url-slug.ts`). */
function slugOf(name: string): string {
  return encodeURIComponent(name.toLowerCase().replace(/\s+/g, '-'));
}

/**
 * The paths of one entity's page. The trailing `*` covers the `.data` navigation request and any
 * query string. Two forms are served: `<slug>-<id>` and the id alone. An older slug from before a
 * rename is a different path that a prefix cannot reach; the route redirects it to the current
 * one, and the week-long TTL covers the rest.
 */
export function followPagePaths(type: FollowTargetType, id: string, name: string): string[] {
  const base = `/${SEGMENT[type]}`;
  const slug = slugOf(name);
  return [...(slug ? [`${base}/${slug}-${id}*`] : []), `${base}/${id}*`];
}

/**
 * Claims the right to purge this target now. A conditional update on a marker item: it succeeds
 * only when no purge was claimed in the last window, so the debounce holds across Lambdas.
 * Returns false when another purge is recent, or when the marker cannot be written (then no
 * purge happens: the TTL is the backstop, and a broken marker must not cause a purge storm).
 */
export async function claimPurgeWindow(
  type: FollowTargetType,
  id: string,
  now: Date = new Date(),
  windowMs: number = FOLLOW_PURGE_WINDOW_MS
): Promise<boolean> {
  try {
    await dynamoClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { pk: `PURGE#${type}#${id}`, sk: 'MARKER' },
        UpdateExpression: 'SET lastPurgedAt = :now',
        ConditionExpression: 'attribute_not_exists(lastPurgedAt) OR lastPurgedAt < :cutoff',
        ExpressionAttributeValues: { ':now': now.getTime(), ':cutoff': now.getTime() - windowMs },
      })
    );
    return true;
  } catch (error) {
    if ((error as { name?: string }).name !== 'ConditionalCheckFailedException') {
      console.error('[follow-purge] marker write failed, not purging', error);
    }
    return false;
  }
}

/**
 * Purges the pages of the targets a follow just changed. The target is resolved through a merge
 * first, since the page that shows the count is the canonical one. Never throws.
 */
export async function purgeFollowedPages(
  targets: Array<{ type: FollowTargetType; id: string }>,
  now: Date = new Date()
): Promise<void> {
  try {
    const seen = new Set<string>();
    const paths: string[] = [];
    for (const { type, id } of targets) {
      const resolved = await resolveFollowTarget(type, id);
      if (!resolved || seen.has(`${resolved.type}:${resolved.id}`)) continue;
      seen.add(`${resolved.type}:${resolved.id}`);
      if (await claimPurgeWindow(resolved.type, resolved.id, now)) {
        paths.push(...followPagePaths(resolved.type, resolved.id, resolved.name));
      }
    }
    await invalidateSitePaths(paths, 'follow count');
  } catch (error) {
    console.error('[follow-purge] failed', error);
  }
}
