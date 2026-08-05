/**
 * The venue and organiser fill sweep, shared by the CLI command and the weekly cron.
 *
 * Lives in core rather than in `packages/scripts` for the reason `rebuildArtistDenormCron`
 * gives: a scheduled run and a manual run must not be able to differ. The script prints the
 * result; this decides it.
 *
 * Cross-domain, so it sits beside `cascade.ts` at the domain root rather than inside either
 * `venue/` or `organiser/`. The rules it applies are the pure functions in `venue/enrich.ts`
 * and `organiser/enrich.ts`, which the approval cascade shares — see
 * `cascadeEventContactToOrganiser`.
 *
 * **An empty field is filled; a filled one is never touched.** That makes the sweep idempotent
 * and safe to schedule: what a person stored survives, and a second run writes nothing.
 *
 * The consequence worth knowing is that `tags` freezes once set. An organiser who starts
 * programming dance after being tagged carnatic-only will not gain `dance` from a later run.
 * That is deliberate — the alternative is re-adding a tag a moderator deliberately removed,
 * every week, with no way to tell that case from "never had it". The sweep exists mainly for
 * records that are *new*: `resolveOrganiser` in `event.submitVerified` creates organisers with
 * nothing but a name every time an event names an unknown one, which is exactly the drift that
 * left 108 of 109 organisers bare.
 */

interface EnrichmentOptions {
  /** Write the fills. Default is to compute them and write nothing. */
  apply?: boolean;
  venuesOnly?: boolean;
  organisersOnly?: boolean;
}

export interface EnrichmentChange {
  id: string;
  name: string;
  fields: Record<string, unknown>;
}

export interface EnrichmentResult {
  venues: EnrichmentChange[];
  organisers: EnrichmentChange[];
  scanned: { venues: number; organisers: number; events: number };
  written: number;
  failures: Array<{ name: string; error: string }>;
}

/** Treats `[]` and `''` as empty, so a record with an empty tag list still gets tags. */
function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/** What the sweep needs off any scanned row. Everything else stays `unknown` for `isEmpty`. */
interface ScannedRecord {
  id: string;
  name: string;
  deletedAt?: string;
  mergedIntoId?: string;
  [field: string]: unknown;
}

/** An event, as `organiser/enrich` reads it, plus the link and the delete markers. */
interface ScannedEvent {
  organiserId?: string;
  artForm?: string;
  tags?: string[];
  entryType?: string;
  startDateTime?: string;
  festivalId?: string;
  contactInfo?: unknown;
  deletedAt?: string;
  mergedIntoId?: string;
}

async function scanAll<T extends { deletedAt?: string; mergedIntoId?: string }>(
  go: (opts: { cursor: string | null; limit: number }) => Promise<{
    data: unknown[];
    cursor: string | null;
  }>
): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | null = null;
  do {
    const result = await go({ cursor, limit: 500 });
    items.push(...(result.data as T[]));
    cursor = result.cursor;
  } while (cursor);
  // Soft-deleted and merged-away rows are not worth filling — the merge target is.
  return items.filter(item => !item.deletedAt && !item.mergedIntoId);
}

export async function enrichVenuesAndOrganisers(
  options: EnrichmentOptions = {}
): Promise<EnrichmentResult> {
  const { apply = false, venuesOnly = false, organisersOnly = false } = options;

  const { VenueEntity } = await import('./venue/entity');
  const { OrganiserEntity } = await import('./organiser/entity');
  const { EventEntity } = await import('./event/entity');
  const { venueTypeFromName } = await import('./venue/enrich');
  const { organisationTypeFromName, organiserContactFromEvents, organiserTagsFromEvents } =
    await import('./organiser/enrich');

  const doVenues = !organisersOnly;
  const doOrganisers = !venuesOnly;

  const [venues, organisers, events] = await Promise.all([
    doVenues ? scanAll<ScannedRecord>(opts => VenueEntity.scan.go(opts)) : Promise.resolve([]),
    doOrganisers
      ? scanAll<ScannedRecord>(opts => OrganiserEntity.scan.go(opts))
      : Promise.resolve([]),
    // Only the organiser half reads events, so a venues-only run skips the largest scan.
    doOrganisers ? scanAll<ScannedEvent>(opts => EventEntity.scan.go(opts)) : Promise.resolve([]),
  ]);

  // ---- Venues: the name is the only source, so venueType is the only field. ----
  const venueChanges: EnrichmentChange[] = [];
  for (const venue of venues) {
    const fields: Record<string, unknown> = {};
    if (isEmpty(venue.venueType)) {
      const venueType = venueTypeFromName(venue.name);
      if (venueType) fields.venueType = venueType;
    }
    if (Object.keys(fields).length) {
      venueChanges.push({ id: venue.id, name: venue.name, fields });
    }
  }

  // ---- Organisers: their own events carry contact details and programme evidence. ----
  const organiserChanges: EnrichmentChange[] = [];
  const eventsByOrganiser = new Map<string, ScannedEvent[]>();
  for (const event of events) {
    if (!event.organiserId) continue;
    const list = eventsByOrganiser.get(event.organiserId) ?? [];
    list.push(event);
    eventsByOrganiser.set(event.organiserId, list);
  }

  for (const organiser of organisers) {
    const own = eventsByOrganiser.get(organiser.id) ?? [];
    const fields: Record<string, unknown> = {};

    const contact = organiserContactFromEvents(own);
    for (const key of ['website', 'phone', 'email'] as const) {
      if (contact[key] && isEmpty(organiser[key])) fields[key] = contact[key];
    }

    if (isEmpty(organiser.tags)) {
      const tags = organiserTagsFromEvents({ name: organiser.name, events: own });
      if (tags.length) fields.tags = tags;
    }

    if (isEmpty(organiser.organisationType)) {
      const organisationType = organisationTypeFromName(organiser.name);
      if (organisationType) fields.organisationType = organisationType;
    }

    if (Object.keys(fields).length) {
      organiserChanges.push({ id: organiser.id, name: organiser.name, fields });
    }
  }

  const result: EnrichmentResult = {
    venues: venueChanges,
    organisers: organiserChanges,
    scanned: { venues: venues.length, organisers: organisers.length, events: events.length },
    written: 0,
    failures: [],
  };

  if (!apply) return result;

  const { updateVenue } = await import('./venue');
  const { updateOrganiser } = await import('./organiser');

  // Sequential: a failure on one record must not stop the rest, and the write volume is a
  // handful of rows per run once the initial backfill has landed.
  for (const change of venueChanges) {
    try {
      await updateVenue(change.id, change.fields as never);
      result.written++;
    } catch (error) {
      result.failures.push({ name: change.name, error: String(error) });
    }
  }
  for (const change of organiserChanges) {
    try {
      await updateOrganiser(change.id, change.fields as never);
      result.written++;
    } catch (error) {
      result.failures.push({ name: change.name, error: String(error) });
    }
  }

  return result;
}
