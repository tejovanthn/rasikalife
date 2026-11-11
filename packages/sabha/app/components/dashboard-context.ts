import { useRouteLoaderData } from 'react-router';
import type { loader } from '~/routes/$targetType.$id';

/**
 * What the dashboard layout loaded: the target, the caller's role on it, and the overview
 * numbers. Every tab reads this instead of asking again.
 */
export function useDashboard() {
  const loaded = useRouteLoaderData<typeof loader>('routes/$targetType.$id');
  if (!loaded) throw new Error('useDashboard must be used inside the dashboard layout');
  return loaded;
}
