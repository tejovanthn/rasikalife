import { Button, Card, CardContent, CardHeader, CardTitle } from '@rasika/ui';
import { useEffect, useState } from 'react';

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISSED_KEY = 'rasika-classes-install-dismissed';

/**
 * The install invitation, on the student's home screen only.
 *
 * The retention thesis of this whole product is an icon on a phone: a student who has to
 * remember a URL marks one class and never comes back. So the prompt is worth showing — once.
 *
 * Dismissed means dismissed. The flag is in `localStorage` rather than component state so it
 * survives a reload, and nothing ever clears it. Re-asking is how an install prompt becomes the
 * thing people close the app to escape.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (window.localStorage.getItem(DISMISSED_KEY)) {
      return;
    }
    // Already installed: `display-mode: standalone` on Chromium and Firefox, `navigator.standalone`
    // on iOS, which does not implement the media query.
    const installed =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    if (installed) {
      return;
    }

    function onPrompt(event: Event) {
      // Chromium fires this and would otherwise show its own mini-infobar. Holding the event
      // lets the prompt appear where it makes sense rather than over the first tap.
      event.preventDefault();
      setDeferred(event as InstallEvent);
      setVisible(true);
    }

    window.addEventListener('beforeinstallprompt', onPrompt);

    // iOS never fires that event and has no programmatic install at all, so Safari users get
    // instructions instead of a button. Without this branch iOS — most of this audience — would
    // see nothing.
    const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    if (isIos) {
      setVisible(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (!visible) {
    return null;
  }

  function dismiss() {
    window.localStorage.setItem(DISMISSED_KEY, '1');
    setVisible(false);
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Keep this on your home screen</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {deferred ? (
          <>
            <p className="text-sm text-muted-foreground">
              One tap to open, no address to remember.
            </p>
            <div className="flex gap-2">
              <Button
                onClick={async () => {
                  await deferred.prompt();
                  await deferred.userChoice;
                  dismiss();
                }}
              >
                Add to home screen
              </Button>
              <Button variant="ghost" onClick={dismiss}>
                Not now
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Tap Share, then <strong>Add to Home Screen</strong>.
            </p>
            <Button variant="ghost" onClick={dismiss}>
              Got it
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
