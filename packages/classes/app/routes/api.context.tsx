import type { ActionFunctionArgs } from 'react-router';
import { redirect } from 'react-router';
import { requireUser } from '~/lib/auth.server';
import { CONTEXT_COOKIE, parseContext, serializeContext } from '~/lib/context';

/**
 * Records the context the user just switched to, then sends them there.
 *
 * A resource route rather than a client-side write, because the value has to be a cookie the
 * *server* can read — the resolver at `/` runs before anything paints, and reading the choice
 * client-side would put a bounce through the wrong context on every cold start.
 *
 * The cookie is not `httpOnly`: nothing secret is in it, and the client may want to read its own
 * last choice later. `SameSite=Lax` so an ordinary navigation carries it.
 */
export async function action({ request }: ActionFunctionArgs) {
  await requireUser(request);
  const formData = await request.formData();

  const stored = parseContext(String(formData.get('context') ?? ''));
  if (!stored) {
    return redirect('/');
  }

  const to =
    stored.kind === 'teaching'
      ? '/teaching'
      : `/home?learner=${encodeURIComponent(stored.learnerId)}`;

  // A year. Losing it costs one redirect to the default, so there is no reason to expire it
  // sooner and every reason not to ask again.
  const cookie = [
    `${CONTEXT_COOKIE}=${serializeContext(stored)}`,
    'Path=/',
    'Max-Age=31536000',
    'SameSite=Lax',
    process.env.NODE_ENV === 'production' ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ');

  return redirect(to, { headers: { 'Set-Cookie': cookie } });
}

export function loader() {
  return redirect('/');
}
