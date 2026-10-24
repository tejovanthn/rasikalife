import { redirect } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import { client } from '~/api.server';
import { safeRedirectPath } from '~/lib/safe-redirect';

/**
 * `rasika.life/l/<code>`: a short link from a WhatsApp text, sent on to the page it stands for
 * with its UTM tags. A code never changes target (it is derived from it), so the redirect is
 * permanent and cached for a year. Resource route: no component.
 */
export async function loader({ params }: LoaderFunctionArgs) {
  const code = (params.code ?? '').toLowerCase();
  const target = safeRedirectPath(await client.shortLink.resolve.query({ code }));
  if (!target) {
    throw new Response('Link not found', {
      status: 404,
      headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' },
    });
  }
  return redirect(target, {
    status: 301,
    headers: {
      'Cache-Control': 'public, max-age=86400, s-maxage=31536000, immutable',
      'X-Robots-Tag': 'noindex',
    },
  });
}
