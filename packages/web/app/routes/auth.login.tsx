import type { LoaderFunctionArgs } from 'react-router';
import { redirect } from 'react-router';
import { authClient, getSession, commitSession } from '~/lib/auth.server';

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const callbackUrl = `${url.origin}/auth/callback`;

  // Generate authorize URL with PKCE
  const { url: authUrl, challenge } = await authClient.authorize(callbackUrl, 'code', {
    pkce: true,
  });

  // Store PKCE challenge in session
  const session = await getSession(request);
  session.set('pkce_challenge', JSON.stringify(challenge));

  return redirect(authUrl, {
    headers: {
      'Set-Cookie': await commitSession(session),
    },
  });
}
