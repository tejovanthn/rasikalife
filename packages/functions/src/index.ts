import * as db from '@rasika/core/db';
import { initTRPC } from '@trpc/server';
import {
  type CreateAWSLambdaContextOptions,
  awsLambdaRequestHandler,
} from '@trpc/server/adapters/aws-lambda';
import { z } from 'zod';

const t = initTRPC.context<CreateAWSLambdaContextOptions<APIGatewayEvent>>().create();

const router = t.router({
  songs: t.router({
    byName: t.procedure.input(z.object({ name: z.string().min(1) })).query(({ input }) => {
      return db.getSongByStartingLetter(input.name);
    }),
    byId: t.procedure.input(z.object({ id: z.string().min(1) })).query(({ input }) => {
      return db.getSongById(input.id);
    }),
    popular: t.procedure.query(() => {
      return db.getTop10Songs();
    }),
    byRaga: t.procedure.input(z.object({ raga: z.string().min(1) })).query(({ input }) => {
      return db.getSongByRaga(input.raga);
    }),
    byTala: t.procedure.input(z.object({ raga: z.string().min(1) })).query(({ input }) => {
      return db.getSongByTala(input.raga);
    }),
    byComposer: t.procedure.input(z.object({ raga: z.string().min(1) })).query(({ input }) => {
      return db.getSongByComposer(input.raga);
    }),
    byLanguage: t.procedure.input(z.object({ raga: z.string().min(1) })).query(({ input }) => {
      return db.getSongByLanguage(input.raga);
    }),
  }),
  ragas: t.router({
    byName: t.procedure.input(z.object({ name: z.string().min(1) })).query(({ input }) => {
      return db.getRagaByStartingLetter(input.name);
    }),
    popular: t.procedure.query(() => {
      return db.getTop10Ragas();
    }),
  }),
  talas: t.router({
    byName: t.procedure.input(z.object({ name: z.string().min(1) })).query(({ input }) => {
      return db.getTalaByStartingLetter(input.name);
    }),
  }),
  languages: t.router({
    byName: t.procedure.input(z.object({ name: z.string().min(1) })).query(({ input }) => {
      return db.getLanguageByStartingLetter(input.name);
    }),
  }),
  composers: t.router({
    byName: t.procedure.input(z.object({ name: z.string().min(1) })).query(({ input }) => {
      return db.getComposerByStartingLetter(input.name);
    }),
  }),
  content: t.router({
    byPath: t.procedure
      .input(z.object({ path: z.string().min(2).startsWith('/') }))
      .query(({ input }) => {
        return db.getContent(input.path);
      }),
    allPaths: t.procedure.query(() => {
      return db.getAllContentPaths();
    }),
  }),
});

export type Router = typeof router;

export const handler = awsLambdaRequestHandler({
  router: router,
  createContext: opts => opts,
});
