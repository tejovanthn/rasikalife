import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
/**
 * Backfills / repairs the `collaborators` list denormalized onto each Artist.
 *
 * Collaborators are computed when an event is approved (see
 * `createEventArtistJunctions` in `packages/core/src/domain/event/index.ts`). Every
 * event approved before that feature shipped contributes nothing, so this sweep
 * derives the full collaborator graph from the EventArtist junction once, from
 * scratch, and is also the repair tool afterwards (e.g. after a bad artist merge).
 *
 * Full sweep: one pass over the EventArtist junction, not a per-artist loop — a
 * naive `for each artist: rebuildArtistCollaborators(id)` would re-read every
 * shared event once per participant.
 *
 * Usage: `pnpm cli rebuild-collaborators [--dry-run] [--artist <id>]`
 */
import { keyOfEntity } from '@rasika/core/db/keys';
import { collaboratorStrength } from '@rasika/core/domain/artist/client';
import type { Collaborator } from '@rasika/core/domain/artist/client';
import { canonicalRole } from '@rasika/core/shared/roles';

const TABLE_NAME = process.env.DYNAMODB_TABLE ?? 'RasikaLifeTable';

interface JunctionRow {
  eventId: string;
  artistId: string;
  artistName: string;
  role?: string;
  eventStartDateTime: string;
}

async function fetchAllJunctionRows(): Promise<JunctionRow[]> {
  const { EventArtistEntity } = await import('../../core/src/domain/event-artist/entity.js');

  const rows: JunctionRow[] = [];
  let cursor: string | null = null;

  do {
    const result = await EventArtistEntity.scan.go({
      attributes: ['eventId', 'artistId', 'artistName', 'role', 'eventStartDateTime'] as never[],
      cursor,
      limit: 1000,
    });
    rows.push(...(result.data as JunctionRow[]));
    cursor = result.cursor;
  } while (cursor);

  return rows;
}

/** Ids of events soft-deleted via `softDeleteEvent`, which sets `deletedAt` but
 * leaves the EventArtist junction rows in place. */
async function fetchDeletedEventIds(): Promise<Set<string>> {
  const { EventEntity } = await import('../../core/src/domain/event/entity.js');

  const ids = new Set<string>();
  let cursor: string | null = null;

  do {
    const result = await EventEntity.scan.go({
      attributes: ['id', 'deletedAt'] as never[],
      cursor,
      limit: 1000,
    });
    for (const row of result.data as Array<{ id: string; deletedAt?: string }>) {
      if (row.deletedAt) {
        ids.add(row.id);
      }
    }
    cursor = result.cursor;
  } while (cursor);

  return ids;
}

function groupByEvent(rows: JunctionRow[]): Map<string, JunctionRow[]> {
  const byEvent = new Map<string, JunctionRow[]>();
  for (const row of rows) {
    const cast = byEvent.get(row.eventId) ?? [];
    cast.push(row);
    byEvent.set(row.eventId, cast);
  }
  return byEvent;
}

interface EdgeAccumulator {
  artistId: string;
  name: string;
  sharedEventCount: number;
  lastSharedAt: string;
  roleCounts: Map<string, number>;
}

const TOP_ROLES_LIMIT = 3;

/**
 * Groups junction rows by event and emits every ordered pair (ai, aj) within each
 * cast into a per-artist edge map: ai's map gains/updates an edge to aj with an
 * incremented sharedEventCount, the max eventStartDateTime as lastSharedAt, and
 * aj's canonical roles tallied for topRoles.
 *
 * No event-status filter is needed here beyond the deletedAt exclusion the caller
 * already applied: `createEventArtistJunctions` only runs when an event is
 * approved, so every row reaching this function already belongs to an approved
 * event — there is no "unapproved junction row" to guard against.
 */
function buildCollaboratorEdges(
  liveRows: JunctionRow[]
): Map<string, Map<string, EdgeAccumulator>> {
  const byEvent = groupByEvent(liveRows);
  const edgesByArtist = new Map<string, Map<string, EdgeAccumulator>>();

  for (const cast of byEvent.values()) {
    for (const ai of cast) {
      const edges = edgesByArtist.get(ai.artistId) ?? new Map<string, EdgeAccumulator>();
      edgesByArtist.set(ai.artistId, edges);

      for (const aj of cast) {
        if (aj.artistId === ai.artistId) continue;

        const edge = edges.get(aj.artistId) ?? {
          artistId: aj.artistId,
          name: aj.artistName,
          sharedEventCount: 0,
          lastSharedAt: aj.eventStartDateTime,
          roleCounts: new Map<string, number>(),
        };
        edge.sharedEventCount += 1;
        edge.name = aj.artistName;
        if (aj.eventStartDateTime > edge.lastSharedAt) {
          edge.lastSharedAt = aj.eventStartDateTime;
        }
        if (aj.role) {
          const role = canonicalRole(aj.role);
          edge.roleCounts.set(role, (edge.roleCounts.get(role) ?? 0) + 1);
        }
        edges.set(aj.artistId, edge);
      }
    }
  }

  return edgesByArtist;
}

function toCollaborators(edges: Map<string, EdgeAccumulator>): Collaborator[] {
  return [...edges.values()]
    .map(edge => {
      const topRoles = [...edge.roleCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, TOP_ROLES_LIMIT)
        .map(([role]) => role);

      return {
        artistId: edge.artistId,
        name: edge.name,
        sharedEventCount: edge.sharedEventCount,
        lastSharedAt: edge.lastSharedAt,
        topRoles: topRoles.length > 0 ? topRoles : undefined,
        strength: collaboratorStrength(edge.sharedEventCount, edge.lastSharedAt),
      };
    })
    .sort((a, b) => b.strength - a.strength);
}

async function writeCollaborators(
  entries: Array<{ artistId: string; collaborators: Collaborator[] }>
): Promise<void> {
  const { ArtistEntity } = await import('../../core/src/domain/artist/entity.js');
  const { dynamoClient } = await import('@rasika/core/db');

  const computedAt = new Date().toISOString();

  const updates = entries.map(({ artistId, collaborators }) =>
    dynamoClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        // ElectroDB lowercases composite key values, so the key must be derived
        // from the entity rather than hand-built in uppercase, or this writes a
        // phantom row instead of updating the real artist.
        Key: keyOfEntity(ArtistEntity, { id: artistId }),
        UpdateExpression:
          'SET collaborators = :collaborators, collaboratorsComputedAt = :computedAt',
        ExpressionAttributeValues: {
          ':collaborators': collaborators,
          ':computedAt': computedAt,
        },
      })
    )
  );

  for (let i = 0; i < updates.length; i += 25) {
    await Promise.all(updates.slice(i, i + 25));
    process.stdout.write(`\r${Math.min(i + 25, updates.length)}/${updates.length} updated…`);
  }
  console.log('\nDone.');
}

function logSample(entries: Array<{ artistId: string; collaborators: Collaborator[] }>): void {
  const SAMPLE_SIZE = 5;
  const EDGES_PER_SAMPLE = 3;

  console.log(`[dry-run] Sample edges (first ${SAMPLE_SIZE} artists):`);
  for (const { artistId, collaborators } of entries.slice(0, SAMPLE_SIZE)) {
    console.log(`  ${artistId}:`);
    for (const c of collaborators.slice(0, EDGES_PER_SAMPLE)) {
      const roles = c.topRoles?.join(', ') ?? '—';
      console.log(
        `    -> ${c.name} (${c.artistId}) shared=${c.sharedEventCount} ` +
          `strength=${c.strength.toFixed(2)} roles=${roles}`
      );
    }
  }
}

async function rebuildAll(dryRun: boolean): Promise<void> {
  console.log('Fetching all EventArtist junction rows…');
  const rows = await fetchAllJunctionRows();
  console.log(`Found ${rows.length} junction rows.`);

  console.log('Fetching soft-deleted event ids…');
  const deletedEventIds = await fetchDeletedEventIds();
  console.log(`Found ${deletedEventIds.size} soft-deleted events.`);

  const liveRows = rows.filter(row => !deletedEventIds.has(row.eventId));
  console.log(`Excluded ${rows.length - liveRows.length} rows belonging to soft-deleted events.`);

  const edgesByArtist = buildCollaboratorEdges(liveRows);
  const entries = [...edgesByArtist.entries()].map(([artistId, edges]) => ({
    artistId,
    collaborators: toCollaborators(edges),
  }));

  console.log(`\n${entries.length} artists have at least one collaborator edge.`);

  if (dryRun) {
    logSample(entries);
    console.log('\n[dry-run] No changes written.');
    return;
  }

  await writeCollaborators(entries);
}

async function rebuildOne(artistId: string, dryRun: boolean): Promise<void> {
  if (dryRun) {
    // rebuildArtistCollaborators writes immediately — there is no dry-run mode at
    // single-artist granularity. Rather than silently mutate on a --dry-run
    // request, skip the call and say so.
    const message = `[dry-run] Single-artist repair calls rebuildArtistCollaborators('${artistId}')`;
    console.log(
      `${message} directly, which writes immediately. Skipping rather than mutating under --dry-run.`
    );
    return;
  }

  const { rebuildArtistCollaborators } = await import('@rasika/core/domain/artist');
  console.log(`Rebuilding collaborators for artist ${artistId}…`);
  await rebuildArtistCollaborators(artistId);
  console.log('Done.');
}

export async function rebuildCollaborators(
  opts: { dryRun?: boolean; artistId?: string } = {}
): Promise<void> {
  const { dryRun = false, artistId } = opts;

  if (artistId) {
    await rebuildOne(artistId, dryRun);
    return;
  }

  await rebuildAll(dryRun);
}
