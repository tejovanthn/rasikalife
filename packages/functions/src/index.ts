import * as db from '@rasika/core/db';
import { initTRPC } from '@trpc/server';
import {
  CreateAWSLambdaContextOptions,
  awsLambdaRequestHandler,
} from '@trpc/server/adapters/aws-lambda';
import { z } from 'zod';

const t = initTRPC
  .context<CreateAWSLambdaContextOptions<APIGatewayEvent>>()
  .create();

const router = t.router({
  songs: t.router({
    byName: t.procedure
      .input(z.object({ name: z.string().min(1) }))
      .query(({ input }) => {
        return db.getSongByStartingLetter(input.name);
      }),
    byId: t.procedure
      .input(z.object({ id: z.string().min(1) }))
      .query(({ input }) => {
        return db.getSongById(input.id);
      }),
    popular: t.procedure.query(() => {
      return db.getTop10Songs();
    }),
    byRaga: t.procedure
      .input(z.object({ raga: z.string().min(1) }))
      .query(({ input }) => {
        return db.getSongByRaga(input.raga);
      }),
  }),
  ragas: t.router({
    byName: t.procedure
      .input(z.object({ name: z.string().min(1) }))
      .query(({ input }) => {
        return db.getRagaByStartingLetter(input.name);
      }),
    popular: t.procedure.query(() => {
      return db.getTop10Ragas();
    }),
  }),
});

export type Router = typeof router;

export const handler = awsLambdaRequestHandler({
  router: router,
  createContext: (opts) => opts,
});
