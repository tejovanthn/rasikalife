import { Field } from '@rasika/ui';
import { useState } from 'react';

type Presigned = { uploadUrl?: string; key?: string; error?: string };

/**
 * Uploads a payment screenshot straight to the private bucket and puts only its **key** into the
 * surrounding form.
 *
 * The bytes never pass through this app's server: the browser asks for a presigned PUT and then
 * writes to S3 directly, which keeps a 4MB phone photo out of a Lambda request body. What comes
 * back is a key, not a URL — there is deliberately no URL that works without a signature, so
 * there is nothing here that would still resolve if the form's HTML leaked. The key is scoped to
 * the institution, and `grantPack` verifies that before storing it.
 *
 * Without JavaScript this renders nothing at all rather than a broken control. The screenshot is
 * optional to the payment record; a guru on a bad connection records the pack and the ledger is
 * still correct.
 */
export function ScreenshotField({ institutionId }: { institutionId: string }) {
  const [key, setKey] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'done' | 'failed'>('idle');
  const [error, setError] = useState<string | null>(null);

  /**
   * Every failure path ends somewhere visible.
   *
   * This had no `try`, and was called as `void upload(file)` — so a dropped connection, a CORS
   * refusal or a non-JSON 502 threw past both `setStatus('failed')` lines as an unhandled
   * rejection. The control sat on "Uploading…" for ever with no error, and the guru waited on
   * something that had already failed.
   *
   * A `useFetcher` was also declared here purely to render `fetcher.data.error`, and was never
   * submitted — so the server's own message, which `/api/upload-url` does return, was read into
   * `presigned` and thrown away. It is surfaced now, and the fetcher is gone.
   */
  async function upload(file: File) {
    setStatus('uploading');
    setError(null);

    try {
      const form = new FormData();
      form.set('institutionId', institutionId);
      form.set('fileName', file.name);
      form.set('contentType', file.type || 'application/octet-stream');

      const response = await fetch('/api/upload-url', { method: 'POST', body: form });
      // A Lambda 502 is HTML, not JSON, so this parse belongs inside the try.
      const presigned = (await response.json()) as Presigned;

      if (!presigned.uploadUrl || !presigned.key) {
        throw new Error(presigned.error ?? 'Could not start the upload.');
      }

      const put = await fetch(presigned.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
      });
      if (!put.ok) {
        throw new Error('The upload did not complete.');
      }

      setKey(presigned.key);
      setStatus('done');
    } catch (cause) {
      // A half-finished upload must not leave a stale key on the form.
      setKey(null);
      setStatus('failed');
      setError(
        cause instanceof Error && cause.message
          ? `${cause.message} You can record the payment without it.`
          : 'That did not upload. You can record the payment without it.'
      );
    }
  }

  return (
    <Field
      label="Payment screenshot"
      htmlFor="screenshot"
      hint="Optional. Only you and this student's family can open it."
      error={error}
    >
      <input
        id="screenshot"
        name="screenshot"
        type="file"
        accept="image/*,application/pdf"
        className="block w-full text-sm file:mr-3 file:min-h-tap file:rounded-md file:border-0 file:bg-secondary file:px-4 file:text-secondary-foreground"
        onChange={event => {
          const file = event.currentTarget.files?.[0];
          if (file) {
            void upload(file);
          }
        }}
      />
      {/* The key travels with the form submit, so the pack row and its screenshot land in one
          write rather than needing a second one to attach it. */}
      {key ? <input type="hidden" name="screenshotKey" value={key} /> : null}
      {status === 'uploading' ? (
        <output className="block text-sm text-muted-foreground">Uploading…</output>
      ) : null}
      {status === 'done' ? (
        <output className="block text-sm text-muted-foreground">Attached.</output>
      ) : null}
    </Field>
  );
}
