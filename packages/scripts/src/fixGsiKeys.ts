/**
 * Fix stale GSI key fields caused by raw DynamoDB UpdateCommands in cascade operations
 * that updated source attributes without updating the corresponding ElectroDB GSI fields.
 *
 * Affected records:
 *  - Events: gsi4pk (VENUE#venueId), gsi5pk (ORGANISER#organiserId)
 *  - Compositions: gsi2pk (ARTIST#composerId)
 *  - EventArtists: gsi1sk (eventStartDateTime)
 */

type DynamoItem = Record<string, unknown>;

async function* scanAll(table: string, filterExpression: string, expressionAttributeValues: DynamoItem) {
  const { ScanCommand } = await import('@aws-sdk/lib-dynamodb');
  const { dynamoClient } = await import('@rasika/core/db');

  let lastEvaluatedKey: DynamoItem | undefined;
  do {
    const result = await dynamoClient.send(
      new ScanCommand({
        TableName: table,
        FilterExpression: filterExpression,
        ExpressionAttributeValues: expressionAttributeValues,
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );
    for (const item of result.Items ?? []) {
      yield item;
    }
    lastEvaluatedKey = result.LastEvaluatedKey as DynamoItem | undefined;
  } while (lastEvaluatedKey);
}

async function applyUpdate(
  table: string,
  key: DynamoItem,
  updates: Record<string, string>
) {
  const { UpdateCommand } = await import('@aws-sdk/lib-dynamodb');
  const { dynamoClient } = await import('@rasika/core/db');

  const setExpressions = Object.keys(updates).map((k, i) => `${k} = :v${i}`);
  const expressionValues: Record<string, unknown> = {};
  Object.values(updates).forEach((v, i) => {
    expressionValues[`:v${i}`] = v;
  });

  await dynamoClient.send(
    new UpdateCommand({
      TableName: table,
      Key: key,
      UpdateExpression: `SET ${setExpressions.join(', ')}`,
      ExpressionAttributeValues: expressionValues,
    })
  );
}

async function fixEvents(table: string, dryRun: boolean) {
  console.log('\n--- Events (gsi4pk / gsi5pk) ---');
  let scanned = 0;
  let fixed = 0;

  for await (const item of scanAll(table, 'begins_with(pk, :pk) AND sk = :sk', {
    ':pk': 'EVENT#',
    ':sk': '#METADATA',
  })) {
    scanned++;

    const updates: Record<string, string> = {};

    const venueId = item.venueId as string | undefined;
    if (venueId) {
      const expected = `VENUE#${venueId}`;
      if (item.gsi4pk !== expected) updates.gsi4pk = expected;
    }

    const organiserId = item.organiserId as string | undefined;
    if (organiserId) {
      const expected = `ORGANISER#${organiserId}`;
      if (item.gsi5pk !== expected) updates.gsi5pk = expected;
    }

    if (Object.keys(updates).length === 0) continue;

    const id = (item.pk as string).replace('EVENT#', '');
    console.log(`  Event ${id}: ${JSON.stringify(updates)}`);

    if (!dryRun) {
      await applyUpdate(table, { pk: item.pk, sk: item.sk }, updates);
    }
    fixed++;
  }

  console.log(`  Scanned: ${scanned}, Fixed: ${fixed}${dryRun ? ' (dry-run)' : ''}`);
}

async function fixCompositions(table: string, dryRun: boolean) {
  console.log('\n--- Compositions (gsi2pk) ---');
  let scanned = 0;
  let fixed = 0;

  for await (const item of scanAll(table, 'begins_with(pk, :pk) AND sk = :sk', {
    ':pk': 'COMPOSITION#',
    ':sk': '#METADATA',
  })) {
    scanned++;

    const composerId = item.composerId as string | undefined;
    if (!composerId) continue;

    const expected = `ARTIST#${composerId}`;
    if (item.gsi2pk === expected) continue;

    const id = (item.pk as string).replace('COMPOSITION#', '');
    console.log(`  Composition ${id}: gsi2pk ${String(item.gsi2pk)} → ${expected}`);

    if (!dryRun) {
      await applyUpdate(table, { pk: item.pk, sk: item.sk }, { gsi2pk: expected });
    }
    fixed++;
  }

  console.log(`  Scanned: ${scanned}, Fixed: ${fixed}${dryRun ? ' (dry-run)' : ''}`);
}

async function fixEventArtists(table: string, dryRun: boolean) {
  console.log('\n--- EventArtists (gsi1sk) ---');
  let scanned = 0;
  let fixed = 0;

  for await (const item of scanAll(table, 'begins_with(pk, :pk) AND begins_with(sk, :sk)', {
    ':pk': 'EVENT#',
    ':sk': 'ARTIST#',
  })) {
    scanned++;

    const eventStartDateTime = item.eventStartDateTime as string | undefined;
    if (!eventStartDateTime) continue;
    if (item.gsi1sk === eventStartDateTime) continue;

    const eventId = (item.pk as string).replace('EVENT#', '');
    const artistId = (item.sk as string).replace('ARTIST#', '');
    console.log(
      `  EventArtist event=${eventId} artist=${artistId}: gsi1sk ${String(item.gsi1sk)} → ${eventStartDateTime}`
    );

    if (!dryRun) {
      await applyUpdate(table, { pk: item.pk, sk: item.sk }, { gsi1sk: eventStartDateTime });
    }
    fixed++;
  }

  console.log(`  Scanned: ${scanned}, Fixed: ${fixed}${dryRun ? ' (dry-run)' : ''}`);
}

export async function fixGsiKeys(opts: { dryRun?: boolean } = {}) {
  const { dryRun = false } = opts;

  const table = process.env.DYNAMODB_TABLE;
  if (!table) {
    console.error('DYNAMODB_TABLE env var is not set');
    process.exit(1);
  }

  console.log(`Fixing stale GSI keys in table: ${table}`);
  if (dryRun) console.log('(dry-run mode — no writes)');

  await fixEvents(table, dryRun);
  await fixCompositions(table, dryRun);
  await fixEventArtists(table, dryRun);

  console.log('\nDone.');
}
