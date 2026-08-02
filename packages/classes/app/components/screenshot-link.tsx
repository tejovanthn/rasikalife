import { Button } from '@rasika/ui';
import { useFetcher } from 'react-router';

type SignedUrl = { url?: string; error?: string };

/**
 * Fetches a signed URL on demand rather than rendering one into the page.
 *
 * A payment screenshot is somebody's UPI transaction record. The signed GET lasts two minutes,
 * so putting one in the HTML would mean every ledger page carried live links to every screenshot
 * on it — into the browser cache, into a screenshot of the screenshot, into anything that
 * scrapes the document. Asking for the URL at the moment someone taps keeps the link's life as
 * close as possible to the intent to look.
 *
 * The request is a POST to a resource route, which re-runs the access check server-side; nothing
 * here is trusted to have checked anything.
 */
export function ScreenshotLink({
  programId,
  learnerId,
  packId,
}: {
  programId: string;
  learnerId: string;
  packId: string;
}) {
  const fetcher = useFetcher<SignedUrl>();
  const url = fetcher.data?.url;

  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-h-tap items-center text-sm text-primary underline"
      >
        Open payment screenshot
      </a>
    );
  }

  return (
    <fetcher.Form method="post" action="/api/screenshot">
      <input type="hidden" name="programId" value={programId} />
      <input type="hidden" name="learnerId" value={learnerId} />
      <input type="hidden" name="packId" value={packId} />
      <Button
        type="submit"
        variant="outline"
        pending={fetcher.state !== 'idle'}
        pendingLabel="Fetching…"
      >
        View payment screenshot
      </Button>
      {fetcher.data?.error ? (
        <p className="mt-1 text-sm text-destructive" role="alert">
          {fetcher.data.error}
        </p>
      ) : null}
    </fetcher.Form>
  );
}
