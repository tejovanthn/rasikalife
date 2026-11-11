import { z } from 'zod';
import type { QR_FORMATS } from '../venue-qr/constants';

export const PDF_STATUSES = ['pending', 'ready', 'failed'] as const;
export type PdfStatus = (typeof PDF_STATUSES)[number];
export type QrFormat = (typeof QR_FORMATS)[number];

export const SetBatchPdfSchema = z.object({
  id: z.string(),
  pdfStatus: z.enum(PDF_STATUSES),
  pdfKey: z.string().optional(),
});

export type SetBatchPdfInput = z.infer<typeof SetBatchPdfSchema>;
