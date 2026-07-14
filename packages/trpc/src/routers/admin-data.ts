import { AdminData } from '@rasika/core';
import { z } from 'zod';
import { triggerReindex } from '../reindex';
import { adminProcedure, createTRPCRouter } from '../trpc';

const DomainSchema = z.enum(AdminData.BULK_DOMAIN_KEYS as [string, ...string[]]);

export const adminDataRouter = createTRPCRouter({
  export: adminProcedure
    .input(z.object({ domain: DomainSchema }))
    .query(({ input }) => AdminData.listAllForDomain(input.domain)),

  import: adminProcedure
    .input(
      z.object({
        domain: DomainSchema,
        rows: z.array(z.record(z.string(), z.unknown())),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const result = await AdminData.bulkUpsertForDomain(input.domain, input.rows, ctx.user.id);
      if (result.created > 0 || result.updated > 0) {
        triggerReindex();
      }
      return result;
    }),
});
