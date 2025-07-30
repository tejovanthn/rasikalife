import { useState, useEffect } from 'react';
import { useFetcher } from '@remix-run/react';
import { Eye } from 'lucide-react';
import { useHydrated } from '~/lib/progressive-enhancement';

interface OptimisticViewCounterProps {
  entityId: string;
  initialViewCount: number;
  showLabel?: boolean;
  entityType?: 'composition' | 'artist' | 'raga' | 'tala';
}

export function OptimisticViewCounter({
  entityId,
  initialViewCount,
  showLabel = true,
  entityType = 'composition',
}: OptimisticViewCounterProps) {
  const [optimisticCount, setOptimisticCount] = useState(initialViewCount);
  const [hasTracked, setHasTracked] = useState(false);
  const isHydrated = useHydrated();
  const fetcher = useFetcher();

  // Track view on mount (with optimistic update)
  useEffect(() => {
    if (isHydrated && !hasTracked) {
      // Optimistically increment the count
      setOptimisticCount(prev => prev + 1);
      setHasTracked(true);

      // Send the actual request
      fetcher.submit(
        { entityId, entityType, action: 'trackView' },
        { method: 'POST', action: '/api/track-view' }
      );
    }
  }, [isHydrated, hasTracked, entityId, entityType, fetcher]);

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
