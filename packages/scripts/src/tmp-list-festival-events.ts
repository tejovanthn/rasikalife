// Read-only: list every event on a festival, including soft-deleted ones.
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';
import { dynamoClient } from '@rasika/core/db';

async function main() {
  const festivalId = process.argv[2];
  const table = Resource.RasikaTable.name;
  console.log(`table: ${table}\n`);

  const result = await dynamoClient.send(
    new QueryCommand({
      TableName: table,
      IndexName: 'gsi3',
      KeyConditionExpression: 'gsi3pk = :pk',
      ExpressionAttributeValues: { ':pk': `festival#${festivalId}`.toLowerCase() },
    })
  );

  for (const item of result.Items ?? []) {
    console.log(
      [
        item.deletedAt ? 'DELETED' : 'ACTIVE ',
        item.id,
        item.status,
        item.startDateTime,
        item.title,
      ].join('  ')
    );
  }
  console.log(`\n${result.Items?.length ?? 0} rows`);
}

main();
