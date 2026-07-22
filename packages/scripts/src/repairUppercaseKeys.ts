/**
 * Repairs the damage done by the uppercase-key bug, then removes the phantom rows.
 *
 * ElectroDB lowercases key values. Several call sites hand-built keys in uppercase, and
 * because DynamoDB's UpdateItem creates a row when the key is absent, each of those wrote
 * a phantom (`EVENT#abc` / `#METADATA`) carrying the attributes the update meant for the
 * real row (`event#abc` / `#metadata`), which was never touched.
 *
 * The phantoms are safe to identify: a real key cannot begin with an uppercase letter.
 *
 * Repair re-derives the correct value from the source of truth rather than replaying the
 * phantom's attributes, which may be months stale:
 *
 *   venueName    the event's venue is looked up and its current name applied. The phantom
 *                may predate a later rename.
 *   rsvpCount    recounted from the event's actual rsvp rows.
 *   other        left alone. Edit rows carry proposedValues that were superseded and are
 *                already approved, so replaying them would resurrect history.
 *
 * Dry run by default. Pass apply: true to write.
 */
import {
  BatchWriteCommand,
  GetCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { dynamoClient } from '@rasika/core/db';

const TABLE_NAME = process.env.DYNAMODB_TABLE ?? 'RasikaLifeTable';
const PHANTOM_PK = /^[A-Z][A-Z_]*#/;

type Row = { pk: string; sk: string; [k: string]: unknown };
type Repair = { pk: string; sk: string; attribute: string; from: unknown; to: unknown };

async function findPhantoms(): Promise<Row[]> {
  const phantoms: Row[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const result = await dynamoClient.send(
      new ScanCommand({ TableName: TABLE_NAME, ExclusiveStartKey: lastKey })
    );
    for (const item of (result.Items ?? []) as Row[]) {
      if (typeof item.pk === 'string' && PHANTOM_PK.test(item.pk)) phantoms.push(item);
    }
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  return phantoms;
}

const getRow = async (pk: string, sk: string) =>
  (await dynamoClient.send(new GetCommand({ TableName: TABLE_NAME, Key: { pk, sk } }))).Item;

export async function repairUppercaseKeys({ apply = false }: { apply?: boolean } = {}) {
  const phantoms = await findPhantoms();
  console.log(`Found ${phantoms.length} phantom rows.\n`);
  if (phantoms.length === 0) return { phantoms: 0, repairs: 0, deleted: 0 };

  const repairs: Repair[] = [];

  for (const phantom of phantoms) {
    const realPk = phantom.pk.toLowerCase();
    const realSk = phantom.sk.toLowerCase();
    const real = await getRow(realPk, realSk);
    if (!real) {
      console.log(`SKIP ${phantom.pk} — no real row at ${realPk}; nothing to repair into.`);
      continue;
    }

    // A venue rename that never landed. Take the venue's current name, not the phantom's.
    if (phantom.venueName !== undefined && typeof real.venueId === 'string') {
      // ElectroDB lowercases the entire key, ids included, so the stored venue key is
      // fully lowercase even though the id itself is mixed-case base62.
      const venue = await getRow(`venue#${real.venueId.toLowerCase()}`, '#metadata');
      const currentName = venue?.name;
      if (typeof currentName === 'string' && currentName !== real.venueName) {
        repairs.push({
          pk: realPk,
          sk: realSk,
          attribute: 'venueName',
          from: real.venueName,
          to: currentName,
        });
      }
      continue;
    }

    // An rsvpCount increment that never landed. Recount rather than trust the phantom.
    if (phantom.rsvpCount !== undefined) {
      const rsvps = await dynamoClient.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          KeyConditionExpression: 'pk = :pk',
          ExpressionAttributeValues: { ':pk': `rsvp#${realPk.split('#')[1]}` },
          Select: 'COUNT',
        })
      );
      const actual = rsvps.Count ?? 0;
      if (real.rsvpCount !== actual) {
        repairs.push({
          pk: realPk,
          sk: realSk,
          attribute: 'rsvpCount',
          from: real.rsvpCount,
          to: actual,
        });
      }
    }
  }

  console.log(`${repairs.length} attribute(s) to repair:\n`);
  for (const r of repairs) {
    console.log(`  ${r.pk}`);
    console.log(`    ${r.attribute}: ${JSON.stringify(r.from)}  →  ${JSON.stringify(r.to)}`);
  }

  if (!apply) {
    console.log(
      `\nDry run. Would repair ${repairs.length} attributes and delete ${phantoms.length} phantoms.`
    );
    return { phantoms: phantoms.length, repairs: repairs.length, deleted: 0 };
  }

  for (const r of repairs) {
    await dynamoClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { pk: r.pk, sk: r.sk },
        UpdateExpression: 'SET #a = :v, updatedAt = :u',
        ExpressionAttributeNames: { '#a': r.attribute },
        ExpressionAttributeValues: { ':v': r.to, ':u': new Date().toISOString() },
        // The row was read a moment ago; refuse to create one if it has since vanished.
        ConditionExpression: 'attribute_exists(pk)',
      })
    );
  }
  console.log(`\nRepaired ${repairs.length} attributes.`);

  let deleted = 0;
  for (let i = 0; i < phantoms.length; i += 25) {
    const chunk = phantoms.slice(i, i + 25);
    await dynamoClient.send(
      new BatchWriteCommand({
        RequestItems: {
          [TABLE_NAME]: chunk.map(p => ({ DeleteRequest: { Key: { pk: p.pk, sk: p.sk } } })),
        },
      })
    );
    deleted += chunk.length;
  }
  console.log(`Deleted ${deleted} phantom rows.`);

  return { phantoms: phantoms.length, repairs: repairs.length, deleted };
}
