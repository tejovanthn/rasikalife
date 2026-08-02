import type { LoaderFunctionArgs } from 'react-router';
import { redirect } from 'react-router';
import { authClient, commitSession, getSession } from '~/lib/auth.server';
import { safeRedirectTo } from '~/lib/redirect-to';

/**
 * The callback URL is built from **this** origin, not the main site's.
 *
 * Signing in from `classes.rasika.life` and being returned to `rasika.life` is the failure the
 * plan's §3.4 checklist names. The OpenAuth issuer already allows any `*.rasika.life` host, so
 * nothing else has to change there; the Google console still needs this origin's callback added
 * to its redirect allowlist.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const callbackUrl = `${url.origin}/auth/callback`;
  const session = await getSession(request);

  // Two overlapping login attempts produce two PKCE challenges and the second exchange fails
  // with invalid_grant. Same guard as the main site.
  const existingChallenge = session.get('pkce_challenge') as string;
  const challengeTimestamp = session.get('pkce_timestamp') as number;
  if (existingChallenge && challengeTimestamp && Date.now() - challengeTimestamp < 120_000) {
    return redirect('/?error=auth_in_progress');
  }

  const redirectTo = url.searchParams.get('redirectTo');
  const { url: authUrl, challenge } = await authClient.authorize(callbackUrl, 'code', {
    pkce: true,
  });

  session.set('pkce_challenge', JSON.stringify(challenge));
  session.set('pkce_timestamp', Date.now());
  // Only a path, and `startsWith('/')` is not that check — see `safeRedirectTo`.
  const safe = safeRedirectTo(redirectTo, '');
  if (safe) {
    session.set('redirect_to', safe);
  }

  return redirect(authUrl, { headers: { 'Set-Cookie': await commitSession(session) } });
}
