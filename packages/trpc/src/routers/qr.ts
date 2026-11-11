import { VenueQr } from '@rasika/core';
import { createTRPCRouter, publicProcedure } from '../trpc';

/**
 * QR routes. Phase 3 has only `resolve`; phase 4 adds the moderator procedures to this file.
 *
 * `resolve` is public: a scan comes from anyone. It never throws for an unknown, unassigned or
 * retired code. The state says which, so the page can show the right Copy. The scan is counted
 * inside `resolveScan`.
 */
export const qrRouter = createTRPCRouter({
  resolve: publicProcedure
    .input(VenueQr.ResolveQrSchema)
    .query(({ input }) => VenueQr.resolveScan(input.code)),
});
