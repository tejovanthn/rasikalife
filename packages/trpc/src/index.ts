import { appRouter } from './routers';
import {
  type CreateAWSLambdaContextOptions,
  awsLambdaRequestHandler,
} from '@trpc/server/adapters/aws-lambda';

export type { AppRouter } from './routers';

export const handler = awsLambdaRequestHandler({
  router: appRouter,
  createContext: (opts: CreateAWSLambdaContextOptions<any>) => opts,
});
