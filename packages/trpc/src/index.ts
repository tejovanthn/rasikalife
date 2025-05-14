import { awsLambdaRequestHandler } from '@trpc/server/adapters/aws-lambda';
import { appRouter } from './routers';
import { createContext } from './context';

// Re-export the router and its type
export { appRouter } from './routers';
export type { AppRouter } from './routers';

// AWS Lambda handler
export const handler = awsLambdaRequestHandler({
  router: appRouter,
  createContext: ({ event }) => {
    // Transform Lambda event into a shape expected by createContext
    return createContext({
      req: {
        headers: event.headers as Record<string, string | undefined>,
        cookies: parseCookies(event.headers.cookie || ''),
      },
      res: {
        // Mock response for Lambda environment
        setHeader: () => {},
        status: () => {},
      },
    });
  },
});

// Helper to parse cookies from header
function parseCookies(cookieHeader = '') {
  const list: Record<string, string> = {};
  cookieHeader.split(';').forEach(cookie => {
    const [name, ...rest] = cookie.split('=');
    const key = name?.trim();
    if (!key) return;
    const value = rest.join('=').trim();
    if (!value) return;
    list[key] = decodeURIComponent(value);
  });
  return list;
}
