import { getSongByName } from '@rasika/core/db';
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
  song: t.procedure
    .input(z.object({ name: z.string().min(1) }))
    .query(({ input }) => {
      return getSongByName(input.name);
    }),
});

export type Router = typeof router;

export const handler = awsLambdaRequestHandler({
  router: router,
  createContext: (opts) => opts,
});
