import type { inferRouterOutputs } from '@trpc/server';
import {
  type CreateAWSLambdaContextOptions,
  awsLambdaRequestHandler,
} from '@trpc/server/adapters/aws-lambda';
import { appRouter } from './routers';
import type { AppRouter } from './routers';

export type { AppRouter } from './routers';
export type RouterOutput = inferRouterOutputs<AppRouter>;

export const handler = awsLambdaRequestHandler({
  router: appRouter,
  createContext: (opts: CreateAWSLambdaContextOptions<any>) => opts,
});
