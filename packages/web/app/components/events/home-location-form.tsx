import { LocateFixed } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { Form } from 'react-router';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';

/**
 * Sets the signed-in reader's home location, which their event listings measure distances
 * from. Posts to /settings/location, which saves it and sends the reader back to `redirectTo`.
 * The PIN works without JavaScript; "Use my location" needs it and appears after hydration.
 * Whatever the browser reports is rounded to about a kilometre before it is stored.
 */
export function HomeLocationForm({ redirectTo, error }: { redirectTo: string; error?: string }) {
  const inputId = useId();
  const deviceForm = useRef<HTMLFormElement>(null);
  const [canLocate, setCanLocate] = useState(false);
  const [locating, setLocating] = useState(false);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  useEffect(() => setCanLocate('geolocation' in navigator), []);

  function useDeviceLocation() {
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        const form = deviceForm.current;
        if (!form) return;
        (form.elements.namedItem('lat') as HTMLInputElement).value = String(pos.coords.latitude);
        (form.elements.namedItem('lng') as HTMLInputElement).value = String(pos.coords.longitude);
        form.requestSubmit();
      },
      () => {
        setLocating(false);
        setDeviceError('Location was not shared.');
      },
      { maximumAge: 10 * 60 * 1000, timeout: 10_000 }
    );
  }

  const message = error ?? deviceError;
  const errorId = `${inputId}-error`;

  // A saved-PIN error arrives with a fresh page (the listing redirects back with it), so
  // nothing tells a screen reader it is there. Focus goes to the PIN field, which reads out
  // the error through aria-describedby; the message itself is then not a live region, or it
  // would be read twice. The device error happens in place and is announced instead.
  const pinInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (error) pinInput.current?.focus();
  }, [error]);

  return (
    <div className="space-y-2">
      <Form method="post" action="/settings/location" className="flex gap-2 items-end">
        <input type="hidden" name="intent" value="pin" />
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <div className="flex-1 space-y-1">
          <Label htmlFor={inputId}>PIN code</Label>
          <Input
            ref={pinInput}
            id={inputId}
            name="pin"
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={7}
            required
            placeholder="560004"
            aria-invalid={error ? true : undefined}
            aria-describedby={message ? errorId : undefined}
          />
        </div>
        <Button type="submit" variant="outline" className="min-h-11 md:min-h-10">
          Save
        </Button>
      </Form>
      {canLocate && (
        <Form ref={deviceForm} method="post" action="/settings/location">
          <input type="hidden" name="intent" value="device" />
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <input type="hidden" name="lat" />
          <input type="hidden" name="lng" />
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-start px-2 min-h-11 md:min-h-10"
            onClick={useDeviceLocation}
            disabled={locating}
          >
            <LocateFixed className="mr-2 h-4 w-4" aria-hidden="true" />
            {locating ? 'Finding you…' : 'Use my location'}
          </Button>
        </Form>
      )}
      {message && (
        // A <p>, not <output>: <output> is a live region of its own and would read the
        // saved-PIN error a second time.
        <p id={errorId} role={error ? undefined : 'alert'} className="text-sm text-destructive">
          {message}
        </p>
      )}
    </div>
  );
}

export const HOME_LOCATION_ERRORS: Record<string, string> = {
  'invalid-pin': 'Enter a six-digit PIN code.',
  'unknown-pin': "We don't know that PIN code yet. Try “Use my location”.",
  'invalid-coordinates': 'That location could not be read.',
};
