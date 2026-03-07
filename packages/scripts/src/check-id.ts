const ENTITY_TYPES = [
  'ARTIST',
  'AWARD',
  'COMPOSITION',
  'CONTENT',
  'EDIT',
  'EVENT',
  'FESTIVAL',
  'ORGANISER',
  'RAGA',
  'TALA',
  'USER',
  'VENUE',
] as const;

export async function checkEvent(id: string) {
  const { GetCommand } = await import('@aws-sdk/lib-dynamodb');
  const { dynamoClient } = await import('@rasika/core/db');

  const table = process.env.DYNAMODB_TABLE;
  if (!table) {
    console.error('DYNAMODB_TABLE env var is not set');
    process.exit(1);
  }

  console.log(`Looking up id: ${id} in table: ${table}\n`);

  const results = await Promise.all(
    ENTITY_TYPES.map(async (type) => {
      const result = await dynamoClient.send(
        new GetCommand({
          TableName: table,
          Key: { pk: `${type}#${id}`, sk: '#METADATA' },
        })
      );
      return { type, item: result.Item };
    })
  );

  const matches = results.filter((r) => r.item != null);

  if (matches.length === 0) {
    console.error(`No entity with id ${id} found (hard deleted or never existed).`);
    process.exit(1);
  }

  for (const { type, item } of matches) {
    if (item.deletedAt) {
      console.log(
        `[${type} — SOFT DELETED at ${item.deletedAt}]${item.mergedIntoId ? ` merged into ${item.mergedIntoId}` : ''}`
      );
    } else {
      console.log(`[${type} — ACTIVE${item.status ? `, status: ${item.status}` : ''}]`);
    }
    console.log(JSON.stringify(item, null, 2));
    console.log();
  }
}
