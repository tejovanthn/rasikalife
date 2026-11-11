import type { LoaderFunctionArgs } from 'react-router';
import { redirect } from 'react-router';
import { requireModerator } from '~/lib/auth.server';

export async function loader({ request }: LoaderFunctionArgs) {
  await requireModerator(request);
  return redirect('/qr');
}
