import type { LoaderFunctionArgs } from 'react-router';
import { redirect } from 'react-router';
import { createServerClient } from '~/lib/api.server';
import { requireUserId } from '~/lib/auth.server';
import { CONTEXT_COOKIE, parseContext, resolveDestination } from '~/lib/context';

/**
 * The context resolver. Redirects and renders nothing.
 *
 * A person here may teach, may learn, or may do both — a guru studying under a senior vidwan
 * while running her own class is the ordinary case, not an edge one. This decides which of those
 * opens, on the server, before anything paints.
 *
 * Server-side and not a client spinner, because the manifest's `start_url` is `/`, so this runs
 * on every cold start from the installed icon. A flash of the wrong context there does not read
 * as a loading state; it reads as the app being broken.
 *
 * It also means a user who *gains* a context — a guru whose own guru just invited her — lands
 * correctly on the next launch without reinstalling anything.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserId(request);
  const trpc = await createServerClient(request);
  const contexts = await trpc.classes.getMyContexts.query();

  const cookie = request.headers.get('Cookie') ?? '';
  const stored = parseContext(
    cookie
      .split(';')
      .map(part => part.trim())
      .find(part => part.startsWith(`${CONTEXT_COOKIE}=`))
      ?.slice(CONTEXT_COOKIE.length + 1)
  );

  return redirect(resolveDestination(contexts, stored));
}
