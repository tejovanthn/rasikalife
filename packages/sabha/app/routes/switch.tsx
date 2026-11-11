import type { LoaderFunctionArgs } from 'react-router';
import { redirect } from 'react-router';
import { requireUser } from '~/lib/auth.server';
import { dashboardPath, isTargetType } from '~/lib/sabha';

/**
 * The header switcher posts `to=organiser:<id>` here. Only a known type becomes a path; the
 * dashboard's own loader then checks that the person manages it.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  await requireUser(request);
  const to = new URL(request.url).searchParams.get('to') ?? '';
  const at = to.indexOf(':');
  const type = to.slice(0, at);
  const id = to.slice(at + 1);
  if (at > 0 && id && isTargetType(type)) throw redirect(dashboardPath(type, id));
  throw redirect('/');
}
