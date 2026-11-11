import { redirect } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import { legacyConcertsRedirect } from '~/lib/events-route';

/**
 * `/<city>/concerts` became `/events/<city>`. Permanent, and it stays: the old URL is indexed
 * and was shared. `/events/concerts` also lands here (city = "events") and is not a city page,
 * so it is a 404 rather than a redirect to `/events/events`.
 */
export const loader = ({ request, params }: LoaderFunctionArgs) => {
  const city = params.city ?? '';
  if (city === 'events') throw new Response('Not Found', { status: 404 });
  throw redirect(legacyConcertsRedirect(city, new URL(request.url).search), 301);
};
