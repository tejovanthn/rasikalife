import type { ActionFunctionArgs } from 'react-router';
import { redirect } from 'react-router';
import { clearTokens } from '~/lib/auth.server';

export async function action({ request }: ActionFunctionArgs) {
  // Clear auth session
  const cookieHeader = await clearTokens(request);

  return redirect('/', {
    headers: {
      'Set-Cookie': cookieHeader,
    },
  });
}

// Redirect GET requests to home
export async function loader() {
  return redirect('/');
}
