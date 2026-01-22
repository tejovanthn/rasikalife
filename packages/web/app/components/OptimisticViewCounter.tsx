import { Eye } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useFetcher, useNavigation } from 'react-router';
import { useHydrated } from '~/lib/progressive-enhancement';

interface OptimisticViewCounterProps {
  entityId: string;
  initialViewCount: number;
  showLabel?: boolean;
  entityType?: 'composition' | 'artist' | 'raga' | 'tala';
  /**
   * Whether this view was already tracked server-side (e.g., on initial page load)
   * When true, prevents double counting by skipping client-side tracking
   */
  wasServerTracked?: boolean;
}

export function OptimisticViewCounter({
  entityId,
  initialViewCount,
  showLabel = true,
  entityType = 'composition',
  wasServerTracked = false,
}: OptimisticViewCounterProps) {
  const [optimisticCount, setOptimisticCount] = useState(initialViewCount);
  const [hasTracked, setHasTracked] = useState(wasServerTracked);
  const isHydrated = useHydrated();
  const fetcher = useFetcher();
  const navigation = useNavigation();

  // Track view on mount (with optimistic update)
  useEffect(() => {
    // Only track if:
    // 1. Page is hydrated (client-side)
    // 2. Haven't tracked this entity yet
    // 3. This wasn't already tracked server-side (prevents double counting)
    if (isHydrated && !hasTracked && !wasServerTracked) {
      // Optimistically increment the count
      setOptimisticCount(prev => prev + 1);
      setHasTracked(true);

      // Send the actual request
      fetcher.submit(
        { entityId, entityType, action: 'trackView' },
        { method: 'POST', action: '/api/track-view' }
      );
    }
  }, [isHydrated, hasTracked, wasServerTracked, entityId, entityType, fetcher]);

  // Reset tracking state when navigating to a new entity
  useEffect(() => {
    setHasTracked(wasServerTracked);
  }, [wasServerTracked]);

  // Handle fetcher response
  useEffect(() => {
    if (fetcher.data && fetcher.state === 'idle') {
      // Update with actual count from server if different
      if (typeof fetcher.data.viewCount === 'number') {
        setOptimisticCount(fetcher.data.viewCount);
      }
    }
  }, [fetcher.data, fetcher.state]);

  return (
    <div className="flex items-center text-sm text-muted-foreground">
      <Eye size={16} className="mr-1" />
      <span>
        {optimisticCount.toLocaleString()}
        {showLabel && ' views'}
      </span>
      {fetcher.state === 'submitting' && <span className="ml-2 text-xs text-primary">•</span>}
    </div>
  );
}
