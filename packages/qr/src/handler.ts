import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { QrBatch, VenueQr } from '@rasika/core';
import type { SQSHandler } from 'aws-lambda';
import { renderBatchJob } from './job';
import { Typesetter } from './typesetter';

const s3 = new S3Client({});
let typesetter: Promise<Typesetter> | undefined;

/** SQS handler. One message is `{ batchId }`; the queue delivers them one at a time. */
export const handler: SQSHandler = async event => {
  const bucket = process.env.PRIVATE_FILES_BUCKET ?? '';
  for (const record of event.Records) {
    const { batchId } = JSON.parse(record.body) as { batchId?: string };
    if (!batchId) {
      console.error('QR render message without a batchId', { body: record.body });
      continue;
    }
    const outcome = await renderBatchJob(batchId, {
      getBatch: id => QrBatch.getQrBatch(id),
      listCodes: async id => (await VenueQr.listQrsInBatch(id)).map(qr => qr.code),
      putPdf: async (key, bytes) => {
        await s3.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: bytes,
            ContentType: 'application/pdf',
          })
        );
      },
      setPdf: input => QrBatch.setBatchPdf(input),
      typesetter: () => {
        typesetter ??= Typesetter.create();
        return typesetter;
      },
      baseUrl: VenueQr.QR_BASE_URL,
    });
    console.log('QR batch render', { batchId, outcome });
  }
};
