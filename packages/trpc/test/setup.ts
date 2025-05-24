import { appRouter } from '../src/routers';
import type { Context } from '../src/context';

// Create a test context
const createTestContext = (): Context => ({
  session: {
    user: {
      id: 'test-user-id',
      email: 'test@example.com',
    },
  },
  req: {
    headers: {},
    cookies: {},
  },
  res: {
    setHeader: () => {},
    status: () => {},
  },
  isBot: false,
});

// Create a test router
export const testRouter = appRouter.createCaller(createTestContext());
