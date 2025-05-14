import type { inferAsyncReturnType } from '@trpc/server';
import { isBotRequest } from './utils/bot-detection';

// Input type for createContext function
interface CreateContextOptions {
  req: {
    headers: Record<string, string | undefined>;
    cookies: Record<string, string>;
  };
  res: {
    setHeader: (name: string, value: string) => void;
    status: (statusCode: number) => void;
  };
}

export async function createContext({ req, res }: CreateContextOptions) {
  // Get the session from the cookie using OpenAuth.js
  const session = await getSession({ req: req as any });

  return {
    session,
    req,
    res,
    isBot: isBotRequest(req),
  };
}

export type Context = inferAsyncReturnType<typeof createContext>;
