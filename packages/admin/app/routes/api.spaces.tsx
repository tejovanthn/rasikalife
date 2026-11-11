import type { LoaderFunctionArgs } from 'react-router';
import { data } from 'react-router';
import { createServerClient } from '~/lib/api.server';
import { requireModerator } from '~/lib/auth.server';

/** The spaces (halls) of one venue, for the picker. JSON, private. */
export async function loader({ request }: LoaderFunctionArgs) {
  await requireModerator(request);
  const venueId = new URL(request.url).searchParams.get('venueId');
  if (!venueId) return data({ spaces: [] }, { headers: { 'Cache-Control': 'private, no-store' } });
  const trpc = await createServerClient(request);
  const spaces = await trpc.space.list.query({ venueId });
  return data(
    { spaces: spaces.map(s => ({ spaceId: s.spaceId, name: s.name })) },
    { headers: { 'Cache-Control': 'private, no-store' } }
  );
}
