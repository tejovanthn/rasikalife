import type { ActionFunctionArgs } from 'react-router';
import { data } from 'react-router';
import { createServerClient } from '~/lib/api.server';
import { requireUser } from '~/lib/auth.server';

/**
 * A presigned PUT into the private bucket, for one payment screenshot.
 *
 * Teacher-only, enforced by the procedure behind this rather than here. Returns a key and an
 * upload URL and no readable URL, because there is no readable URL — reads go through
 * `/api/screenshot`, which signs a short-lived GET after checking who is asking.
 */
export async function action({ request }: ActionFunctionArgs) {
  await requireUser(request);
  const formData = await request.formData();
  const trpc = await createServerClient(request);

  try {
    const result = await trpc.classes.screenshotUploadUrl.mutate({
      institutionId: String(formData.get('institutionId') ?? ''),
      fileName: String(formData.get('fileName') ?? 'upload'),
      contentType: String(formData.get('contentType') ?? ''),
    });
    return data(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return data(
      { error: error instanceof Error ? error.message : 'Could not start the upload' },
      { status: 400 }
    );
  }
}
