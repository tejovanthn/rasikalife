import type { ActionFunctionArgs } from 'react-router';
import { data } from 'react-router';
import { createServerClient } from '~/lib/api.server';
import { requireUser } from '~/lib/auth.server';

/**
 * Hands back a short-lived signed GET for one payment screenshot.
 *
 * A resource route with no component: it returns JSON, and a UI route cannot do that for a
 * document request. The key is never accepted from the client — the procedure behind this reads
 * it off the pack row after running the access check, so a caller cannot ask for a signature
 * over somebody else's object.
 */
export async function action({ request }: ActionFunctionArgs) {
  await requireUser(request);
  const formData = await request.formData();
  const trpc = await createServerClient(request);

  try {
    const result = await trpc.classes.screenshotUrl.mutate({
      programId: String(formData.get('programId') ?? ''),
      learnerId: String(formData.get('learnerId') ?? ''),
      packId: String(formData.get('packId') ?? ''),
    });
    return data(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return data(
      { error: error instanceof Error ? error.message : 'Could not open that screenshot' },
      { status: 400 }
    );
  }
}
