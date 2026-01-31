import { createContext, useContext } from 'react';
import type { SessionUser } from '~/lib/auth.server';

interface AuthContextValue {
  user: SessionUser | null;
}

export const AuthContext = createContext<AuthContextValue>({ user: null });

export function useAuth() {
  return useContext(AuthContext);
}
