import type { createServerClient } from '~/api.server';
import type { PanelStat } from '~/lib/venue-qr-panel';

type ServerClient = Awaited<ReturnType<typeof createServerClient>>;

/**
 * Scan and follow stats of the venue's QR codes, for moderators only.
 *
 * A signed-out reader and an ordinary signed-in reader never reach the call, so the shared,
 * cached signed-out page carries no panel data. A moderator's document is `private` already (the
 * cache key holds `rasika_session` and `applyDefaultCacheControl` marks it uncacheable), the same
 * reason the Follow state is safe. `qr.statsByVenue` is a `moderatorProcedure`, so the server
 * refuses anyone else too. A failure shows no panel; it never breaks the venue page.
 */
export async function loadVenueQrPanel(
  client: ServerClient,
  isModerator: boolean,
  venueId: string
): Promise<PanelStat[]> {
  if (!isModerator) return [];
  try {
    return await client.qr.statsByVenue.query({ venueId });
  } catch (error) {
    console.error('Failed to load venue QR stats:', error);
    return [];
  }
}
