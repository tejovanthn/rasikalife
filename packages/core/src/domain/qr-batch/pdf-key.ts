/**
 * Where a batch's PDF lives in the private bucket (`PRIVATE_FILES_BUCKET`, never the public CDN
 * bucket). Derived from the batch id, so a re-render overwrites the same object.
 */
export function qrBatchPdfKey(batchId: string): string {
  return `qr-batches/${batchId}.pdf`;
}
