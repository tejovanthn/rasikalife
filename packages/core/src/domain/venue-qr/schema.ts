import { z } from 'zod';
import { ErrorCode } from '../../constants';
import { QR_BATCH_MAX, QR_BULK_ASSIGN_MAX, QR_FORMATS } from './constants';

export const QR_STATUSES = ['unassigned', 'active', 'retired'] as const;
export type QrStatus = (typeof QR_STATUSES)[number];

export const QrCodeSchema = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{8}$/);
export const QrLabelSchema = z.string().trim().min(1).max(60);
export const QrNoteSchema = z.string().trim().max(200).optional();

export const QR_ERROR_CODES = {
  QR_NOT_FOUND: ErrorCode.QR_NOT_FOUND,
  QR_NOT_UNASSIGNED: ErrorCode.QR_NOT_UNASSIGNED,
  QR_RETIRED: ErrorCode.QR_RETIRED,
  QR_BATCH_LIMIT: ErrorCode.QR_BATCH_LIMIT,
  QR_CODE_COLLISION: ErrorCode.QR_CODE_COLLISION,
  VENUE_NOT_FOUND: ErrorCode.VENUE_NOT_FOUND,
  SPACE_NOT_FOUND: ErrorCode.SPACE_NOT_FOUND,
} as const;

export const ResolveQrSchema = z.object({
  code: QrCodeSchema,
  /**
   * Count this read as a scan. Only the `/q/:code` document loader sets it. The add-a-concert
   * and done pages read the same code without adding to the day's scan count.
   */
  count: z.boolean().optional(),
});

export const CreateQrBatchSchema = z.object({
  count: z.number().int().min(1).max(QR_BATCH_MAX),
  format: z.enum(QR_FORMATS),
  note: QrNoteSchema,
});

export const AssignQrSchema = z.object({
  code: QrCodeSchema,
  venueId: z.string(),
  spaceId: z.string().optional(),
  label: QrLabelSchema,
  note: QrNoteSchema,
});

export const BulkAssignItemSchema = z.object({ code: QrCodeSchema, label: QrLabelSchema });

export const BulkAssignQrSchema = z.object({
  // Each code carries its own label: one batch is spread over different spots.
  items: z
    .array(BulkAssignItemSchema)
    .min(1)
    .max(QR_BULK_ASSIGN_MAX)
    .refine(items => new Set(items.map(item => item.code)).size === items.length, {
      message: 'Each code can appear once',
    }),
  venueId: z.string(),
  spaceId: z.string().optional(),
});

export const UpdateQrLabelSchema = z.object({ code: QrCodeSchema, label: QrLabelSchema });

export const ReassignQrSchema = z.object({
  code: QrCodeSchema,
  venueId: z.string(),
  spaceId: z.string().optional(),
  label: QrLabelSchema,
});

export const RetireQrSchema = z.object({ code: QrCodeSchema });

export const ListQrSchema = z.object({
  status: z.enum(QR_STATUSES).optional(),
  batchId: z.string().optional(),
  venueId: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.number().int().max(100).default(50),
});

export type AssignQrInput = z.infer<typeof AssignQrSchema>;
export type BulkAssignQrInput = z.infer<typeof BulkAssignQrSchema>;
export type UpdateQrLabelInput = z.infer<typeof UpdateQrLabelSchema>;
export type ReassignQrInput = z.infer<typeof ReassignQrSchema>;
export type ListQrInput = z.input<typeof ListQrSchema>;
