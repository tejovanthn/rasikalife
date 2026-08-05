/**
 * Fill venue and organiser records from what the database already knows.
 *
 * Both lists are name-only in prod: of 132 venues, 8 carry anything besides a name; of 109
 * organisers, one does. This fills the fields that can be *derived* — never the ones that
 * would have to be looked up or guessed.
 *
 * What it writes, and on what evidence:
 *
 * | Field                          | Source                                        |
 * |--------------------------------|-----------------------------------------------|
 * | `organiser.website/phone/email`| `contactInfo` on that organiser's own events  |
 * | `organiser.tags`               | artForm, tags and entryType across their events|
 * | `organiser.organisationType`   | an explicit word in the name                  |
 * | `venue.venueType`              | an explicit word in the name                  |
 *
 * Two rules hold throughout:
 *
 * **An empty field is filled; a filled one is never touched.** What is already stored was put
 * there by a person, and a derivation is weaker evidence than that. A re-run is therefore a
 * no-op, which is what makes this safe to run again after new events land.
 *
 * **Event `contactInfo` belongs to the organiser, never the venue.** Grouped by organiser the
 * data is self-consistent and the domain matches the name; grouped by venue it is nonsense —
 * "Zoom" collects Trikala's website and the J.N. Tata Auditorium collects SPIC MACAY's. The
 * reasoning is in `domain/organiser/enrich.ts`. Do not extend this to venues.
 *
 * Everything needing a person — city, capacity, founded year, street address, description —
 * is deliberately out of scope. Those already have a path: export the domain from
 * `/admin/data/<domain>/export`, edit the spreadsheet, and upload it back.
 *
 * Usage: `pnpm prod-cli enrich-venues-organisers` (dry run), then `--apply`.
 */

interface Options {
  apply?: boolean;
  venuesOnly?: boolean;
  organisersOnly?: boolean;
}

interface Change {
  id: string;
  name: string;
  fields: Record<string, unknown>;
}

/** Treats `[]` and `''` as empty, so a record with an empty tag list still gets tags. */
function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function report(label: string, changes: Change[], total: number): void {
  console.log(`\n${label}: ${changes.length} of ${total} records would gain fields.`);
  if (!changes.length) return;

  const perField = new Map<string, number>();
  for (const change of changes) {
    for (const field of Object.keys(change.fields)) {
      perField.set(field, (perField.get(field) ?? 0) + 1);
    }
  }
  for (const [field, count] of [...perField].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${field.padEnd(20)} ${count}`);
  }

  console.log('');
  for (const change of changes) {
    const summary = Object.entries(change.fields)
      .map(([key, value]) => `${key}=${Array.isArray(value) ? value.join('|') : String(value)}`)
      .join('  ');
    console.log(`  ${change.name.slice(0, 44).padEnd(46)}${summary}`);
  }
}

export async function enrichVenuesOrganisers(options: Options = {}): Promise<void> {
  const { apply = false, venuesOnly = false, organisersOnly = false } = options;
  const { AdminData, Organiser, Venue } = await import('@rasika/core');

  const doVenues = !organisersOnly;
  const doOrganisers = !venuesOnly;

  console.log('Reading venues, organisers and events…');
  const [venues, organisers, events] = await Promise.all([
    AdminData.listAllForDomain('venue'),
    AdminData.listAllForDomain('organiser'),
    AdminData.listAllForDomain('event'),
  ]);
  console.log(
    `  ${venues.length} venues, ${organisers.length} organisers, ${events.length} events`
  );

  // ---- Venues: the name is the only source, so venueType is the only field. ----
  const venueChanges: Change[] = [];
  if (doVenues) {
    for (const venue of venues as any[]) {
      if (venue.deletedAt) continue;

      const fields: Record<string, unknown> = {};
      if (isEmpty(venue.venueType)) {
        const venueType = Venue.venueTypeFromName(venue.name);
        if (venueType) fields.venueType = venueType;
      }
      if (Object.keys(fields).length) {
        venueChanges.push({ id: venue.id, name: venue.name, fields });
      }
    }
  }

  // ---- Organisers: their own events carry contact details and programme evidence. ----
  const organiserChanges: Change[] = [];
  if (doOrganisers) {
    const eventsByOrganiser = new Map<string, any[]>();
    for (const event of events as any[]) {
      if (!event.organiserId || event.deletedAt) continue;
      const list = eventsByOrganiser.get(event.organiserId) ?? [];
      list.push(event);
      eventsByOrganiser.set(event.organiserId, list);
    }

    for (const organiser of organisers as any[]) {
      if (organiser.deletedAt) continue;
      const own = eventsByOrganiser.get(organiser.id) ?? [];
      const fields: Record<string, unknown> = {};

      const contact = Organiser.organiserContactFromEvents(own);
      for (const key of ['website', 'phone', 'email'] as const) {
        if (contact[key] && isEmpty(organiser[key])) fields[key] = contact[key];
      }

      if (isEmpty(organiser.tags)) {
        const tags = Organiser.organiserTagsFromEvents({ name: organiser.name, events: own });
        if (tags.length) fields.tags = tags;
      }

      if (isEmpty(organiser.organisationType)) {
        const organisationType = Organiser.organisationTypeFromName(organiser.name);
        if (organisationType) fields.organisationType = organisationType;
      }

      if (Object.keys(fields).length) {
        organiserChanges.push({ id: organiser.id, name: organiser.name, fields });
      }
    }
  }

  if (doVenues) report('VENUES', venueChanges, venues.length);
  if (doOrganisers) report('ORGANISERS', organiserChanges, organisers.length);

  if (!apply) {
    console.log('\nDry run — nothing written. Re-run with --apply to write these.');
    return;
  }

  console.log('\nWriting…');
  let written = 0;
  const failures: Array<{ name: string; error: string }> = [];

  for (const change of venueChanges) {
    try {
      await Venue.updateVenue(change.id, change.fields as any);
      written++;
    } catch (error) {
      failures.push({ name: change.name, error: String(error) });
    }
  }
  for (const change of organiserChanges) {
    try {
      await Organiser.updateOrganiser(change.id, change.fields as any);
      written++;
    } catch (error) {
      failures.push({ name: change.name, error: String(error) });
    }
  }

  console.log(`Updated ${written} records.`);
  if (failures.length) {
    console.log(`\n${failures.length} failed:`);
    for (const failure of failures) console.log(`  ${failure.name}: ${failure.error}`);
  }
  console.log('\nReindex search so the new fields are searchable: pnpm prod-cli reindex');
}
