import type { LoaderFunctionArgs } from 'react-router';
import { data } from 'react-router';
import { createServerClient } from '~/lib/api.server';
import { requireUser } from '~/lib/auth.server';
import { isTargetType } from '~/lib/sabha';

const PRIVATE = { 'Cache-Control': 'private, no-store' };

/**
 * The halls of one venue, for the event form's Space list. The caller names the dashboard they
 * are on (`targetType`, `targetId`) so `partner.spacesForVenue` can check they manage it.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  await requireUser(request);
  const params = new URL(request.url).searchParams;
  const targetType = params.get('targetType') ?? undefined;
  const targetId = params.get('targetId');
  const venueId = params.get('venueId');
  if (!isTargetType(targetType) || !targetId || !venueId) {
    return data({ spaces: [] as Array<{ spaceId: string; name: string }> }, { headers: PRIVATE });
  }
  const trpc = await createServerClient(request);
  const spaces = await trpc.partner.spacesForVenue.query({ targetType, targetId, venueId });
  return data({ spaces }, { headers: PRIVATE });
}
