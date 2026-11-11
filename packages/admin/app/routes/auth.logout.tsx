import type { ActionFunctionArgs } from 'react-router';
import { redirect } from 'react-router';
import { clearTokens } from '~/lib/auth.server';

export async function action({ request }: ActionFunctionArgs) {
  // Clears the cookie for the whole `.rasika.life` domain, so this signs the visitor out of the
  // main site too. That is the honest behaviour for one shared session — a "log out" that left
  // them signed in elsewhere would be worse.
  return redirect('/', { headers: { 'Set-Cookie': await clearTokens(request) } });
}

export async function loader() {
  return redirect('/');
}
