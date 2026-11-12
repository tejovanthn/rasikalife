import { QrBatch, VenueQr } from '@rasika/core';
import { ApplicationError, ErrorCode } from '@rasika/core/constants';
import { TRPCError } from '@trpc/server';
import type { TRPC_ERROR_CODE_KEY } from '@trpc/server';
import { z } from 'zod';
import { requireVenueAccess } from '../partner-guard';
import { enqueueBatchRender } from '../qr-render-queue';
import { createTRPCRouter, moderatorProcedure, protectedProcedure, publicProcedure } from '../trpc';

const CODE_BY_ERROR: Partial<Record<ErrorCode, TRPC_ERROR_CODE_KEY>> = {
  [ErrorCode.QR_NOT_FOUND]: 'NOT_FOUND',
  [ErrorCode.VENUE_NOT_FOUND]: 'NOT_FOUND',
  [ErrorCode.SPACE_NOT_FOUND]: 'NOT_FOUND',
  [ErrorCode.QR_NOT_UNASSIGNED]: 'CONFLICT',
  [ErrorCode.QR_RETIRED]: 'CONFLICT',
  [ErrorCode.QR_BATCH_LIMIT]: 'BAD_REQUEST',
  [ErrorCode.VALIDATION_ERROR]: 'BAD_REQUEST',
};

/**
 * Core's `ApplicationError` becomes a `TRPCError` that keeps it as `cause`, so the admin app can
 * read `cause.code` (`QR_NOT_UNASSIGNED`, `QR_RETIRED`) and show the right Copy.
 */
export function toQrTrpcError(error: unknown): unknown {
  if (error instanceof ApplicationError) {
    return new TRPCError({
      code: CODE_BY_ERROR[error.code as ErrorCode] ?? 'INTERNAL_SERVER_ERROR',
      message: error.message,
      cause: error,
    });
  }
  return error;
}

export async function mapQrErrors<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    throw toQrTrpcError(error);
  }
}

const BatchIdSchema = z.object({ batchId: z.string().min(1) });
const VenueIdSchema = z.object({ venueId: z.string().min(1) });

/** Sets the batch back to `pending` and queues the render. A failure to queue marks it failed. */
async function queueRender(batchId: string): Promise<QrBatch.QrBatch> {
  try {
    await QrBatch.setBatchPdf({ id: batchId, pdfStatus: 'pending' });
    await enqueueBatchRender(batchId);
    const batch = await QrBatch.getQrBatch(batchId);
    if (!batch) throw new ApplicationError(ErrorCode.VALIDATION_ERROR, 'Batch not found');
    return batch;
  } catch (error) {
    console.error('Could not queue the QR batch render', { batchId, error });
    return QrBatch.setBatchPdf({ id: batchId, pdfStatus: 'failed' });
  }
}

/**
 * QR routes. `resolve` is public: a scan comes from anyone, and it never throws for an unknown,
 * unassigned or retired code (the state says which). Everything else is a moderator or admin.
 *
 * `statsByVenue` is open to a moderator or any member (viewer or owner) of that venue. A member
 * of an organiser does not read it here: the organiser dashboard gets its home venue's numbers
 * through `partner.overview`.
 */
export const qrRouter = createTRPCRouter({
  resolve: publicProcedure
    .input(VenueQr.ResolveQrSchema)
    .query(({ input }) =>
      VenueQr.resolveScan(input.code, new Date(), { count: input.count === true })
    ),

  createBatch: moderatorProcedure.input(VenueQr.CreateQrBatchSchema).mutation(({ ctx, input }) =>
    mapQrErrors(async () => {
      const { batch, codes } = await QrBatch.createQrBatch({ ...input, createdBy: ctx.user.id });
      const queued = await queueRender(batch.id);
      return { batch: queued, codeCount: codes.length };
    })
  ),

  /** "PDF failed. Try again": same codes, new render. */
  rerenderBatch: moderatorProcedure.input(BatchIdSchema).mutation(({ input }) =>
    mapQrErrors(async () => {
      const batch = await QrBatch.getQrBatch(input.batchId);
      if (!batch) throw new ApplicationError(ErrorCode.QR_NOT_FOUND, 'Batch not found');
      return queueRender(batch.id);
    })
  ),

  listBatches: moderatorProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).optional(),
        cursor: z.string().optional(),
      })
    )
    .query(({ input }) => QrBatch.listQrBatches({ limit: input.limit, nextToken: input.cursor })),

  getBatch: moderatorProcedure.input(BatchIdSchema).query(({ input }) =>
    mapQrErrors(async () => {
      const batch = await QrBatch.getQrBatch(input.batchId);
      if (!batch) throw new ApplicationError(ErrorCode.QR_NOT_FOUND, 'Batch not found');
      const codes = await VenueQr.listQrsInBatch(batch.id);
      const downloadUrl =
        batch.pdfStatus === 'ready' && batch.pdfKey
          ? await QrBatch.getQrBatchPdfUrl(batch.pdfKey)
          : undefined;
      return { batch, codes, downloadUrl };
    })
  ),

  list: moderatorProcedure
    .input(VenueQr.ListQrSchema)
    .query(({ input }) => mapQrErrors(() => VenueQr.listQrs(input))),

  /** One code, for the assign form. */
  get: moderatorProcedure.input(VenueQr.ResolveQrSchema).query(({ input }) =>
    mapQrErrors(async () => {
      const qr = await VenueQr.getQr(input.code);
      if (!qr)
        throw new ApplicationError(ErrorCode.QR_NOT_FOUND, `QR code ${input.code} not found`);
      return qr;
    })
  ),

  assign: moderatorProcedure
    .input(VenueQr.AssignQrSchema)
    .mutation(({ ctx, input }) =>
      mapQrErrors(() => VenueQr.assignQr({ ...input, userId: ctx.user.id }))
    ),

  bulkAssign: moderatorProcedure
    .input(VenueQr.BulkAssignQrSchema)
    .mutation(({ ctx, input }) =>
      mapQrErrors(() => VenueQr.bulkAssignQr({ ...input, userId: ctx.user.id }))
    ),

  updateLabel: moderatorProcedure
    .input(VenueQr.UpdateQrLabelSchema)
    .mutation(({ ctx, input }) =>
      mapQrErrors(() => VenueQr.updateQrLabel({ ...input, userId: ctx.user.id }))
    ),

  reassign: moderatorProcedure
    .input(VenueQr.ReassignQrSchema)
    .mutation(({ ctx, input }) =>
      mapQrErrors(() => VenueQr.reassignQr({ ...input, userId: ctx.user.id }))
    ),

  retire: moderatorProcedure
    .input(VenueQr.RetireQrSchema)
    .mutation(({ ctx, input }) =>
      mapQrErrors(() => VenueQr.retireQr({ code: input.code, userId: ctx.user.id }))
    ),

  statsByVenue: protectedProcedure.input(VenueIdSchema).query(async ({ ctx, input }) => {
    await requireVenueAccess(ctx.user, input.venueId, 'viewer');
    return mapQrErrors(() => VenueQr.statsByVenue(input.venueId));
  }),
});
