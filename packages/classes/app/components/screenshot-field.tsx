import { Field } from '@rasika/ui';
import { useState } from 'react';
import { useFetcher } from 'react-router';

type Presigned = { uploadUrl?: string; key?: string; error?: string };

/**
 * Uploads a payment screenshot straight to the private bucket and puts only its **key** into the
 * surrounding form.
 *
 * The bytes never pass through this app's server: the browser asks for a presigned PUT and then
 * writes to S3 directly, which keeps a 4MB phone photo out of a Lambda request body. What comes
 * back is a key, not a URL — there is deliberately no URL that works without a signature, so
 * there is nothing here that would still resolve if the form's HTML leaked.
 *
 * Without JavaScript this renders nothing at all rather than a broken control. The screenshot is
 * optional to the payment record; a guru on a bad connection records the pack and the ledger is
 * still correct.
 */
export function ScreenshotField({ institutionId }: { institutionId: string }) {
  const fetcher = useFetcher<Presigned>();
  const [key, setKey] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'done' | 'failed'>('idle');

  async function upload(file: File) {
    setStatus('uploading');

    const form = new FormData();
    form.set('institutionId', institutionId);
    form.set('fileName', file.name);
    form.set('contentType', file.type || 'application/octet-stream');

    const response = await fetch('/api/upload-url', { method: 'POST', body: form });
    const presigned = (await response.json()) as Presigned;

    if (!presigned.uploadUrl || !presigned.key) {
      setStatus('failed');
      return;
    }

    const put = await fetch(presigned.uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
    });

    if (!put.ok) {
      setStatus('failed');
      return;
    }

    setKey(presigned.key);
    setStatus('done');
  }

  return (
    <Field
      label="Payment screenshot"
      htmlFor="screenshot"
      hint="Optional. Only you and this student's family can open it."
      error={
        status === 'failed' ? 'That did not upload. You can record the payment without it.' : null
      }
    >
      <input
        id="screenshot"
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
      {fetcher.data?.error ? (
        <p className="text-sm text-destructive" role="alert">
          {fetcher.data.error}
        </p>
      ) : null}
    </Field>
  );
}
