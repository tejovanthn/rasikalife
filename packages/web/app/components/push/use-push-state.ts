import { useEffect, useState } from 'react';
import type { PushUiState } from '~/lib/push';
import { readPushState } from '~/lib/push-client';

/**
 * What this device can do with web push. `null` until mounted: the server cannot know, and
 * rendering a guess would not match the first client render.
 */
export function usePushState(vapidKey: string | null) {
  const [state, setState] = useState<PushUiState | null>(null);
  useEffect(() => {
    let live = true;
    readPushState(vapidKey).then(next => {
      if (live) setState(next);
    });
    return () => {
      live = false;
    };
  }, [vapidKey]);
  return [state, setState] as const;
}
