import {
  type CreateAWSLambdaContextOptions,
  awsLambdaRequestHandler,
} from '@trpc/server/adapters/aws-lambda';
import { appRouter } from './routers';

export type { AppRouter } from './routers';

export const handler = awsLambdaRequestHandler({
  router: appRouter,
  createContext: (opts: CreateAWSLambdaContextOptions<any>) => opts,
});
