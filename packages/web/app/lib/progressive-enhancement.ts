// Progressive Enhancement utilities for Remix apps
// These utilities ensure functionality works without JavaScript and enhances with JS

import { useEffect, useState } from 'react';

/**
 * Hook to detect if JavaScript is enabled and component has hydrated
 * Useful for progressive enhancement
 */
export function useHydrated() {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  return hydrated;
}

/**
 * Hook for enhanced form handling with optimistic UI
 * Falls back to standard form submission without JS
 */
export function useProgressiveForm(onSuccess?: () => void) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    // Only prevent default if JavaScript is enabled
    if (typeof window !== 'undefined') {
      event.preventDefault();
      setIsPending(true);
      setError(null);

      try {
        const form = event.currentTarget;
        const formData = new FormData(form);

        const response = await fetch(form.action, {
          method: form.method,
          body: formData,
        });

        if (!response.ok) {
          throw new Error('Form submission failed');
        }

        onSuccess?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong');
      } finally {
        setIsPending(false);
      }
    }
    // If JavaScript is disabled, form will submit normally
  };

  return { handleSubmit, isPending, error };
}

/**
 * Progressive enhancement for keyboard navigation
 */
export function useKeyboardNavigation(items: HTMLElement[], onSelect?: (index: number) => void) {
  const [selectedIndex, setSelectedIndex] = useState(-1);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 1, items.length - 1));
          break;
        case 'ArrowUp':
          event.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, -1));
          break;
        case 'Enter':
          if (selectedIndex >= 0) {
            event.preventDefault();
            onSelect?.(selectedIndex);
          }
          break;
        case 'Escape':
          setSelectedIndex(-1);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [items.length, selectedIndex, onSelect]);

  // Update focus when selectedIndex changes
  useEffect(() => {
    if (selectedIndex >= 0 && items[selectedIndex]) {
      items[selectedIndex].focus();
    }
  }, [selectedIndex, items]);

  return selectedIndex;
}

/**
 * Progressive loading with fallback content
 */
export function useProgressiveLoad<T>(loadFunction: () => Promise<T>, fallbackData?: T) {
  const [data, setData] = useState<T | undefined>(fallbackData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await loadFunction();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, error, load };
}
