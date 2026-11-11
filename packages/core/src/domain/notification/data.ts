/**
 * The reads behind the two jobs. Each is one idea, so `run.ts` can swap them in tests.
 *
 * Cost, for December volume (hundreds of events): one range query for events, one artist query
 * per event, one follower query per *distinct* target (memoised in `run.ts`), one RSVP query per
 * event, then batch gets for users and concert-book rows. Nothing runs once per follower.
 */
import { batchGetAll } from '../../shared/batch-get';
import { ConcertLogEntity } from '../concert-log/entity';
import { getEventArtists } from '../event-artist';
import { EventEntity } from '../event/entity';
import { listAllFollowersOfTarget } from '../follow';
import { listPushSubscriptions } from '../push-subscription';
import { RsvpEntity } from '../rsvp/entity';
import { UserEntity } from '../user/entity';
import type { User } from '../user/entity';
import type { NotifyEvent } from './match';

const DAY_MS = 24 * 60 * 60 * 1000;
const READ_CONCURRENCY = 8;
const BATCH_SIZE = 100;

/** Runs `fn` over `items` with at most `limit` in flight. Order of results matches `items`. */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index] as T);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

const EVENT_ATTRIBUTES = [
  'id',
  'title',
  'startDateTime',
  'endDateTime',
  'timezone',
  'venueId',
  'venueName',
  'organiserId',
  'organiserName',
] as const;

/**
 * Approved, not deleted, starting in `[from, to)`. Stored start times carry their own offsets
 * (`+05:30` beside `Z`) and the key compares as a string, so the query is a day wider each way
 * and the exact cut is made on parsed instants by the caller (`inWindow`).
 */
export async function loadEventsInRange(from: Date, to: Date): Promise<NotifyEvent[]> {
  const result = await EventEntity.query
    .byStatus({ status: 'approved' })
    .between(
      { startDateTime: new Date(from.getTime() - DAY_MS).toISOString() },
      { startDateTime: new Date(to.getTime() + DAY_MS).toISOString() }
    )
    .where((attr, op) => op.notExists(attr.deletedAt))
    .go({ pages: 'all', attributes: [...EVENT_ATTRIBUTES] as never[] });
  return (result.data ?? []) as NotifyEvent[];
}

export async function loadArtistsForEvents(
  eventIds: string[]
): Promise<Map<string, Array<{ artistId: string; artistName: string }>>> {
  const rows = await mapLimit(eventIds, READ_CONCURRENCY, async eventId => {
    const { items } = await getEventArtists(eventId, { limit: 100 });
    return [eventId, items.map(i => ({ artistId: i.artistId, artistName: i.artistName }))] as const;
  });
  return new Map(rows);
}

export async function loadFollowerIds(type: 'venue' | 'organiser' | 'artist', id: string) {
  const follows = await listAllFollowersOfTarget(type, id);
  return follows.map(f => f.userId);
}

/** Who said they are going, per event, from the `Rsvp` primary index (`RSVP#${eventId}`). */
export async function loadRsvpUsers(eventIds: string[]): Promise<Map<string, string[]>> {
  const rows = await mapLimit(eventIds, READ_CONCURRENCY, async eventId => {
    const result = await RsvpEntity.query.byEvent({ eventId }).go({ pages: 'all' });
    return [eventId, (result.data ?? []).map(r => r.userId)] as const;
  });
  return new Map(rows);
}

export async function loadUsers(ids: string[]): Promise<User[]> {
  const batches = await mapLimit(chunk([...new Set(ids)], BATCH_SIZE), 4, async batch => {
    const rows = await batchGetAll(batch.map(id => ({ id })), keys => UserEntity.get(keys).go());
    return rows as User[];
  });
  return batches.flat();
}

/** `userId:eventId` for every pair that is already in the user's concert book. */
export async function loadLoggedKeys(
  pairs: Array<{ userId: string; eventId: string }>
): Promise<Set<string>> {
  const batches = await mapLimit(chunk(pairs, BATCH_SIZE), 4, async batch => {
    const rows = await batchGetAll(batch, keys => ConcertLogEntity.get(keys).go());
    return rows.map(row => `${row.userId}:${row.eventId}`);
  });
  return new Set(batches.flat());
}

/**
 * Which of these users have at least one push subscription. One key-only query per user, at most
 * `READ_CONCURRENCY` at a time: the primary key is the user, so there is no index to scan.
 */
export async function loadPushUserIds(userIds: string[]): Promise<Set<string>> {
  const found = await mapLimit([...new Set(userIds)], READ_CONCURRENCY, async id => {
    const rows = await listPushSubscriptions(id);
    return rows.length > 0 ? id : null;
  });
  return new Set(found.filter((id): id is string => id !== null));
}
