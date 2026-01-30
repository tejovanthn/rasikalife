import { createContext, useContext } from 'react';
import type { AuthUser } from '~/root';

interface AuthContextValue {
  user: AuthUser | null;
}

export const AuthContext = createContext<AuthContextValue>({ user: null });

export function useAuth() {
  return useContext(AuthContext);
}
