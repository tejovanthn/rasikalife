import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';

const lambdaClient = new LambdaClient({});
const THROTTLE_MS = 5 * 60 * 1000;
let lastTriggeredAt = 0;

export function triggerReindex(): void {
  const functionName = process.env.SEARCH_REINDEX_FUNCTION_NAME;
  if (!functionName) return;

  const now = Date.now();
  if (now - lastTriggeredAt < THROTTLE_MS) return;
  lastTriggeredAt = now;

  lambdaClient
    .send(
      new InvokeCommand({
        FunctionName: functionName,
        InvocationType: 'Event',
        Payload: Buffer.from('{}'),
      })
    )
    .catch((err) => console.error('[reindex] Failed to trigger reindex', err));
}
