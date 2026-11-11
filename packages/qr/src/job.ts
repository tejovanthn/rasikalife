import { qrBatchPdfKey } from '@rasika/core/domain/qr-batch/client';
import type { PdfStatus, QrFormat } from '@rasika/core/domain/qr-batch/client';
import { renderBatchPdf } from './layout';
import type { Typesetter } from './typesetter';

export type RenderDeps = {
  getBatch(id: string): Promise<{ id: string; format: QrFormat; note?: string } | null>;
  listCodes(batchId: string): Promise<string[]>;
  putPdf(key: string, bytes: Uint8Array): Promise<void>;
  setPdf(input: { id: string; pdfStatus: PdfStatus; pdfKey?: string }): Promise<unknown>;
  typesetter(): Promise<Typesetter>;
  baseUrl: string;
};

export type RenderOutcome = 'ready' | 'failed' | 'missing';

/**
 * Renders one batch and records the result on the batch row. Codes are never touched, so a
 * re-render (after a design change, or after a failure) produces the same codes on new paper.
 *
 * A failure is recorded as `failed` and swallowed, not rethrown: SQS would retry a render that
 * fails for a stable reason (a bad font file) and fill the dead-letter queue, and the batch page
 * already offers "PDF failed. Try again".
 */
export async function renderBatchJob(batchId: string, deps: RenderDeps): Promise<RenderOutcome> {
  const batch = await deps.getBatch(batchId);
  if (!batch) {
    console.error('QR batch not found', { batchId });
    return 'missing';
  }
  try {
    const codes = await deps.listCodes(batch.id);
    if (codes.length === 0) throw new Error('Batch has no codes');
    const typesetter = await deps.typesetter();
    const bytes = await renderBatchPdf({
      format: batch.format,
      codes,
      baseUrl: deps.baseUrl,
      typesetter,
      title: `rasika.life QR ${batch.format} batch ${batch.id}`,
    });
    const key = qrBatchPdfKey(batch.id);
    await deps.putPdf(key, bytes);
    await deps.setPdf({ id: batch.id, pdfStatus: 'ready', pdfKey: key });
    return 'ready';
  } catch (error) {
    console.error('QR batch render failed', { batchId, error });
    await deps.setPdf({ id: batch.id, pdfStatus: 'failed' });
    return 'failed';
  }
}
