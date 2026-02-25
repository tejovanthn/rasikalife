import { createContext } from 'react';
import type { DisplayScript } from '~/sessions.server';

export const ScriptContext = createContext<{
  script: DisplayScript;
  setScript: (script: DisplayScript) => void;
  isPending: boolean;
}>({
  script: 'iast',
  setScript: () => {},
  isPending: false,
});
