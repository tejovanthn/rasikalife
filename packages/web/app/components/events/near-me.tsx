import { LocateFixed } from 'lucide-react';
import { createContext, useContext, useEffect, useId, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { type Point, distanceKm, formatDistance, isPin } from '~/lib/distance';

/**
 * "≈ 6 km from you" on the listings. Everything happens in the browser: the page is cached
 * once for every reader (see `cacheUntilMidnight`), so a reader's location must never reach
 * the server or a cookie. The chosen point lives in `localStorage`, a per-reader convenience
 * that may be missing and is never relied on.
 */

interface Origin extends Point {
  label: string;
}

const STORAGE_KEY = 'rl_near_v1';
const NearContext = createContext<{ origin: Origin | null; setOrigin: (o: Origin | null) => void }>(
  {
    origin: null,
    setOrigin: () => {},
  }
);

function readStored(): Origin | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Origin) : null;
    return parsed && Number.isFinite(parsed.lat) && Number.isFinite(parsed.lng) ? parsed : null;
  } catch {
    return null;
  }
}

function store(origin: Origin | null) {
  try {
    if (origin) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(origin));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Private mode or blocked storage: the distance still shows for this visit.
  }
}

export function NearProvider({ children }: { children: ReactNode }) {
  const [origin, setOriginState] = useState<Origin | null>(null);
  // Read after hydration, so the server's HTML and the first client render agree.
  useEffect(() => setOriginState(readStored()), []);
  const setOrigin = (o: Origin | null) => {
    store(o);
    setOriginState(o);
  };
  return <NearContext.Provider value={{ origin, setOrigin }}>{children}</NearContext.Provider>;
}

/** The distance to one venue, or nothing when either end is unknown. */
export function EventDistance({ lat, lng }: { lat?: number | null; lng?: number | null }) {
  const { origin } = useContext(NearContext);
  if (!origin || typeof lat !== 'number' || typeof lng !== 'number') return null;
  return (
    <span className="text-sm text-muted-foreground">
      {formatDistance(distanceKm(origin, { lat, lng }))} away
    </span>
  );
}

let pinTable: Promise<Record<string, [number, number]>> | null = null;

function loadPins() {
  pinTable ??= fetch('/pin-centroids.json')
    .then(res => (res.ok ? res.json() : { pins: {} }))
    .then((file: { pins: Record<string, [number, number]> }) => file.pins)
    .catch(() => {
      pinTable = null;
      return {};
    });
  return pinTable;
}

export function NearMeControl() {
  const { origin, setOrigin } = useContext(NearContext);
  const [message, setMessage] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const inputId = useId();
  useEffect(() => setMounted(true), []);

  // Distances need JavaScript; without it there is nothing this control could do.
  if (!mounted) return null;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get('pin') ?? '').replace(/\s+/g, '');
    if (!isPin(value)) {
      setMessage('Enter a six-digit PIN code.');
      return;
    }
    const hit = (await loadPins())[value];
    if (!hit) {
      setMessage("We don't know that PIN code yet. Try “Use my location”.");
      return;
    }
    setMessage(null);
    setOrigin({ lat: hit[0], lng: hit[1], label: value });
  }

  function useLocation() {
    if (!('geolocation' in navigator)) {
      setMessage('This browser cannot share a location.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        setMessage(null);
        setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: 'your location' });
      },
      () => setMessage('Location was not shared.'),
      { maximumAge: 10 * 60 * 1000, timeout: 10_000 }
    );
  }

  return (
    <section aria-labelledby={`${inputId}-heading`} className="space-y-2">
      <h2 id={`${inputId}-heading`} className="text-sm font-semibold">
        Distance from you
      </h2>
      {origin ? (
        <p className="text-sm text-muted-foreground">
          From {origin.label}.{' '}
          <button
            type="button"
            className="text-primary underline-offset-4 hover:underline min-h-11 md:min-h-0"
            onClick={() => setOrigin(null)}
          >
            Change
          </button>
        </p>
      ) : (
        <>
          <form onSubmit={onSubmit} className="flex gap-2 items-end">
            <div className="flex-1 space-y-1">
              <Label htmlFor={inputId}>PIN code</Label>
              <Input
                id={inputId}
                name="pin"
                inputMode="numeric"
                autoComplete="postal-code"
                maxLength={7}
                placeholder="560004"
              />
            </div>
            <Button type="submit" variant="outline" className="min-h-11 md:min-h-10">
              Show
            </Button>
          </form>
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-start px-2 min-h-11 md:min-h-10"
            onClick={useLocation}
          >
            <LocateFixed className="mr-2 h-4 w-4" aria-hidden="true" />
            Use my location
          </Button>
        </>
      )}
      {message && <output className="block text-sm text-destructive">{message}</output>}
      <p className="text-xs text-muted-foreground">
        Straight-line distance. Your location stays in this browser.
      </p>
    </section>
  );
}
