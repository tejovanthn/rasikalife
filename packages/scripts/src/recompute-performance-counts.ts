import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
/**
 * Recomputes performanceCount on Composition and Raga entities from authoritative
 * EventSetlist GSI data. Run nightly to correct counter drift.
 *
 * Usage: sst shell tsx src/recompute-performance-counts.ts
 */
import { Composition, EventSetlist, Raga } from '@rasika/core';
import { keyOfEntity } from '@rasika/core/db/keys';

// Minimal imports to avoid circular deps
const { dynamoClient } = await import('@rasika/core/db');
const TABLE_NAME = process.env.DYNAMODB_TABLE ?? 'RasikaLifeTable';

async function fetchAllEventSetlistRows(): Promise<
  Array<{ compositionId?: string; ragaId?: string }>
> {
  const { EventSetlistEntity } = await import('../../core/src/domain/event-setlist/entity.js');

  const rows: Array<{ compositionId?: string; ragaId?: string }> = [];
  let cursor: string | null = null;

  do {
    const result = await EventSetlistEntity.scan.go({
      attributes: ['compositionId', 'ragaId'] as never[],
      cursor,
      limit: 1000,
    });
    rows.push(...(result.data as Array<{ compositionId?: string; ragaId?: string }>));
    cursor = result.cursor;
  } while (cursor);

  return rows;
}

async function main() {
  console.log('Fetching all EventSetlist rows…');
  const rows = await fetchAllEventSetlistRows();
  console.log(`Found ${rows.length} EventSetlist rows.`);

  const { CompositionEntity } = await import('../../core/src/domain/composition/entity.js');
  const { RagaEntity } = await import('../../core/src/domain/raga/entity.js');

  const compositionCounts = new Map<string, number>();
  const ragaCounts = new Map<string, number>();

  for (const row of rows) {
    if (row.compositionId) {
      compositionCounts.set(row.compositionId, (compositionCounts.get(row.compositionId) ?? 0) + 1);
    }
    if (row.ragaId) {
      ragaCounts.set(row.ragaId, (ragaCounts.get(row.ragaId) ?? 0) + 1);
    }
  }

  console.log(
    `Updating ${compositionCounts.size} composition counts, ${ragaCounts.size} raga counts…`
  );

  const compositionUpdates = [...compositionCounts.entries()].map(([id, count]) =>
    dynamoClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        // ElectroDB lowercases composite key values, so the key must be derived from
        // the entity rather than hand-built in uppercase, or this writes a phantom row.
        Key: keyOfEntity(CompositionEntity, { id }),
        UpdateExpression: 'SET performanceCount = :count',
        ExpressionAttributeValues: { ':count': count },
      })
    )
  );

  const ragaUpdates = [...ragaCounts.entries()].map(([id, count]) =>
    dynamoClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: keyOfEntity(RagaEntity, { id }),
        UpdateExpression: 'SET performanceCount = :count',
        ExpressionAttributeValues: { ':count': count },
      })
    )
  );

  // Run in parallel batches of 25
  const all = [...compositionUpdates, ...ragaUpdates];
  for (let i = 0; i < all.length; i += 25) {
    await Promise.all(all.slice(i, i + 25));
    process.stdout.write(`\r${Math.min(i + 25, all.length)}/${all.length} updated…`);
  }

  console.log('\nDone.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
