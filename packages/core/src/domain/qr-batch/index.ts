import { ApplicationError, ErrorCode } from '../../constants';
import { generateId } from '../../utils';
import { QR_BATCH_MAX } from '../venue-qr/constants';
import { mintQrCodes } from '../venue-qr/mint';
import { QrBatchEntity } from './entity';
import type { QrBatch } from './entity';
import type { QrFormat, SetBatchPdfInput } from './schema';

export type { QrBatch } from './entity';
export { PDF_STATUSES, SetBatchPdfSchema } from './schema';
export type { PdfStatus, QrFormat, SetBatchPdfInput } from './schema';

/**
 * Creates the batch row, then mints its codes. The batch row goes first and carries
 * `pdfStatus = pending`; the PDF job (a later phase) moves it to `ready` or `failed`.
 *
 * Over 200 codes is `QR_BATCH_LIMIT`, checked before anything is written.
 */
export async function createQrBatch(input: {
  count: number;
  format: QrFormat;
  note?: string;
  createdBy: string;
}): Promise<{ batch: QrBatch; codes: string[] }> {
  if (!Number.isInteger(input.count) || input.count < 1) {
    throw new ApplicationError(ErrorCode.VALIDATION_ERROR, 'Count must be a positive integer');
  }
  if (input.count > QR_BATCH_MAX) {
    throw new ApplicationError(
      ErrorCode.QR_BATCH_LIMIT,
      `A batch holds at most ${QR_BATCH_MAX} codes`
    );
  }

  const id = generateId();
  const created = await QrBatchEntity.create({
    id,
    format: input.format,
    count: input.count,
    note: input.note,
    pdfStatus: 'pending',
    createdBy: input.createdBy,
  }).go();

  const codes = await mintQrCodes(input.count, id);
  return { batch: created.data as QrBatch, codes };
}

export async function getQrBatch(id: string): Promise<QrBatch | null> {
  const result = await QrBatchEntity.get({ id }).go();
  return (result.data as QrBatch | null) ?? null;
}

/** Newest first. */
export async function listQrBatches(params?: {
  limit?: number;
  nextToken?: string;
}): Promise<{ items: QrBatch[]; nextToken?: string; hasMore: boolean }> {
  const result = await QrBatchEntity.query.list({}).go({
    limit: params?.limit ?? 50,
    cursor: params?.nextToken,
    order: 'desc',
  });
  return {
    items: (result.data as QrBatch[]) ?? [],
    nextToken: result.cursor ?? undefined,
    hasMore: Boolean(result.cursor),
  };
}

/** Called by the PDF job. `pdfKey` is removed (rule 8) when a re-render fails or restarts. */
export async function setBatchPdf(input: SetBatchPdfInput): Promise<QrBatch> {
  const patch = QrBatchEntity.patch({ id: input.id });
  const result = await (input.pdfKey
    ? patch.set({ pdfStatus: input.pdfStatus, pdfKey: input.pdfKey })
    : patch.set({ pdfStatus: input.pdfStatus }).remove(['pdfKey'])
  ).go({ response: 'all_new' });
  return result.data as QrBatch;
}
