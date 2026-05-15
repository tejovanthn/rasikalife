import { useEffect, useState } from 'react';
import type { SetlistDraft } from './types';

type StoredDraft = {
  data: SetlistDraft;
  savedAt: number; // Unix ms
};

export function useLocalDraft(eventId: string, initial: SetlistDraft, serverUpdatedAt?: string) {
  const key = `concert-log-draft-${eventId}`;

  const [draft, setDraft] = useState<SetlistDraft>(() => {
    if (typeof window === 'undefined') return initial;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const stored = JSON.parse(raw) as StoredDraft;
        const serverMs = serverUpdatedAt ? new Date(serverUpdatedAt).getTime() : 0;
        if (stored.savedAt > serverMs) return stored.data;
      }
    } catch {
      // ignore malformed storage
    }
    return initial;
  });

  const [savedAt, setSavedAt] = useState<Date | null>(null);

  // Debounced persistence — writes after 300ms of inactivity
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const stored: StoredDraft = { data: draft, savedAt: Date.now() };
        localStorage.setItem(key, JSON.stringify(stored));
        setSavedAt(new Date());
      } catch {
        // storage full or disabled
      }
    }, 300);
    return () => clearTimeout(t);
  }, [key, draft]);

  return {
    draft,
    setDraft,
    clearDraft: () => {
      try {
        localStorage.removeItem(key);
      } catch {
        // ignore
      }
    },
    savedAt,
  };
}
