import { createClient } from '@openauthjs/openauth/client';
import { Auth, User } from '@rasika/core';
import type { inferRouterOutputs } from '@trpc/server';
import {
  type CreateAWSLambdaContextOptions,
  awsLambdaRequestHandler,
} from '@trpc/server/adapters/aws-lambda';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { appRouter } from './routers';
import type { AppRouter } from './routers';
import type { Context } from './trpc';

export type { AppRouter } from './routers';
export type RouterOutput = inferRouterOutputs<AppRouter>;

// Get auth issuer URL from environment
function getAuthURL(): string {
  if (process.env.AUTH_URL) {
    return process.env.AUTH_URL;
  }
  return 'http://localhost:3000';
}

// Lazy-loaded OpenAuth client for token verification
let _authClient: ReturnType<typeof createClient> | null = null;

function getAuthClient() {
  if (!_authClient) {
    const issuerUrl = getAuthURL();
    console.log('[trpc] Creating OpenAuth client with issuer:', issuerUrl);
    _authClient = createClient({
      clientID: 'rasika-api',
      issuer: issuerUrl,
    });
  }
  return _authClient;
}

// Create context from Lambda event with JWT verification
const createContext = async ({
  event,
}: CreateAWSLambdaContextOptions<APIGatewayProxyEventV2>): Promise<Context> => {
  let user: User.User | null = null;

  // Get auth token from Authorization header
  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);

    try {
      // Verify JWT token with OpenAuth
      const authClient = getAuthClient();
      const verified = await authClient.verify(Auth.subjects, token);

      if (!verified.err && verified.subject) {
        const userId = verified.subject.properties.userID;

        // Fetch user from database if userId exists
        if (userId) {
          user = await User.getUser(userId);
        }
      }
    } catch (error) {
      console.error('[trpc] Error verifying token:', error);
    }
  }

  return { user, event };
};

export const handler = awsLambdaRequestHandler({
  router: appRouter,
  createContext,
});
