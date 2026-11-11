import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

let client: SQSClient | undefined;

/**
 * Asks the PDF renderer (`packages/qr`) to render a batch. The queue url comes from
 * `QR_RENDER_QUEUE_URL`, set in `infra/trpc.ts`. The message holds only the batch id: the
 * renderer reads the codes from the table, so a re-render never changes them.
 */
export async function enqueueBatchRender(batchId: string): Promise<void> {
  const queueUrl = process.env.QR_RENDER_QUEUE_URL;
  if (!queueUrl) throw new Error('QR_RENDER_QUEUE_URL is not set');
  client ??= new SQSClient({});
  await client.send(
    new SendMessageCommand({ QueueUrl: queueUrl, MessageBody: JSON.stringify({ batchId }) })
  );
}
