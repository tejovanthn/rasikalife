import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { TABLE_NAME, dynamoClient } from '../db/client';

/**
 * A fixed-window counter on the main table: one item per key per window, bumped with an atomic
 * `ADD`, so it holds across Lambdas. The window start is part of the sort key, so a new window
 * is a new item and an old count never needs an expiry check. `expiresAt` (epoch seconds) is
 * written on each item so DynamoDB TTL can sweep them once TTL is switched on for the table
 * (it is not today; the items are one small row per active user per minute).
 *
 * Fails open: if the counter cannot be read, the call is allowed. A broken limiter must not
 * lock everybody out of following.
 */
export async function hitRateLimit(input: {
  key: string;
  limit: number;
  windowSec: number;
  now?: Date;
}): Promise<{ allowed: boolean; hits: number }> {
  const nowSec = Math.floor((input.now ?? new Date()).getTime() / 1000);
  const windowStart = nowSec - (nowSec % input.windowSec);
  try {
    const result = await dynamoClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { pk: `RATELIMIT#${input.key}`, sk: `WINDOW#${windowStart}` },
        UpdateExpression: 'ADD hits :one SET expiresAt = :exp',
        ExpressionAttributeValues: { ':one': 1, ':exp': windowStart + input.windowSec * 2 },
        ReturnValues: 'UPDATED_NEW',
      })
    );
    const hits = Number(result.Attributes?.hits ?? 1);
    return { allowed: hits <= input.limit, hits };
  } catch (error) {
    console.error('[rate-limit] counter failed, allowing', error);
    return { allowed: true, hits: 0 };
  }
}
