/**
 * Lands reviewed bio-extraction proposals.
 *
 * Reads the CSV produced by `extract-artist-bios` after a human has filled in the `decision`
 * column, and splits the accepted rows by where they belong:
 *
 * - Artist attributes (gurus, credentials, works, arangetram) become `Edit` drafts, submitted
 *   for moderation, so they flow through the existing approval path and land in ChangeHistory
 *   like any other change. One draft per artist, not per row.
 * - Affiliations write straight to the ArtistAffiliation junction. They cannot ride the Edit
 *   path: the edit registry keys every handler on a single entity id, and a junction row is
 *   keyed on the artist/organiser pair.
 *
 * Every accepted row is stamped `source: 'bio-extraction'`, so a later reader can tell a
 * machine's reading of a bio apart from a moderator's own entry.
 *
 * Usage: `pnpm cli import-bio-extractions --file <path> --user <userId> [--dry-run]`
 */
import { readFile } from 'node:fs/promises';
// The edit service is exported flat, not under an `Edit` namespace — `Edit` itself is a type.
import {
  Artist,
  ArtistAffiliation,
  Organiser,
  Venue,
  createDraft,
  getActiveEditForEntity,
  submitEdit,
} from '@rasika/core';
import { parseCsv } from '@rasika/core/admin/csv';
import { PROPOSAL_COLUMNS } from '@rasika/core/domain/artist/bio-proposals';
import { isGuruRelationship } from '@rasika/core/domain/artist/client';

const SOURCE = 'bio-extraction' as const;

/** A `decision` cell counts as acceptance only if it says so. Blank means "not reviewed". */
const ACCEPTED = new Set(['y', 'yes', 'true', '1', 'accept', 'x']);

type Row = Record<string, string>;

function parseRows(text: string): Row[] {
  const table = parseCsv(text);
  if (table.length === 0) return [];

  const header = table[0].map(h => h.trim());
  // Checked rather than assumed: a reviewer who reorders or deletes a column in a spreadsheet
  // would otherwise have every field read from the wrong place, silently.
  const missing = PROPOSAL_COLUMNS.filter(column => !header.includes(column));
  if (missing.length > 0) {
    throw new Error(`CSV is missing required columns: ${missing.join(', ')}`);
  }

  return table.slice(1).map(cells => {
    const row: Row = {};
    for (const [index, key] of header.entries()) row[key] = (cells[index] ?? '').trim();
    return row;
  });
}

const optionalYear = (value: string): number | undefined => {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1800 && parsed <= 2100 ? parsed : undefined;
};

/** The reviewer's correction wins over the extractor's reading whenever one is present. */
const finalValue = (row: Row): string => row.correctedValue || row.value;

export async function importBioExtractions(opts: {
  file: string;
  userId: string;
  dryRun?: boolean;
}): Promise<void> {
  const { file, userId, dryRun = false } = opts;

  const rows = parseRows(await readFile(file, 'utf8'));
  const accepted = rows.filter(row => ACCEPTED.has(row.decision.toLowerCase()));

  console.log(`${rows.length} rows in the file, ${accepted.length} accepted.`);
  if (accepted.length === 0) {
    console.log('Nothing to do — fill in the `decision` column with y for the rows to apply.');
    return;
  }

  const byArtist = new Map<string, Row[]>();
  for (const row of accepted) {
    if (!row.artistId) continue;
    byArtist.set(row.artistId, [...(byArtist.get(row.artistId) ?? []), row]);
  }

  let draftsCreated = 0;
  let affiliationsWritten = 0;
  let affiliationsSkipped = 0;
  let skippedOpenEdit = 0;
  let failures = 0;

  for (const [artistId, artistRows] of byArtist) {
    const artist = await Artist.getArtist(artistId);
    if (!artist) {
      console.error(`  ${artistId}: artist not found, skipping ${artistRows.length} rows`);
      failures++;
      continue;
    }

    // Gurus, credentials and works are appended to what is already stored, never replaced: a
    // moderator may have added rows by hand since the extraction ran, and this is an import,
    // not a source of truth.
    const gurus = [...(artist.gurus ?? [])];
    const credentials = [...(artist.credentials ?? [])];
    const works = [...(artist.works ?? [])];
    const proposedValues: Record<string, unknown> = {};
    let touchedArtist = false;

    for (const row of artistRows) {
      const value = finalValue(row);
      if (!value && row.proposalType !== 'arangetram') continue;

      switch (row.proposalType) {
        case 'guru': {
          // A relationship that does not narrow is dropped rather than defaulted — guessing
          // 'primary' is exactly the overstatement this whole field exists to prevent.
          if (!isGuruRelationship(row.relationship)) {
            console.warn(`  ${artist.name}: guru "${value}" has no valid relationship, skipped`);
            continue;
          }
          if (gurus.some(g => g.name === value)) continue;
          gurus.push({
            id: row.resolvedId || undefined,
            name: value,
            relationship: row.relationship,
            fromYear: optionalYear(row.startYear),
            toYear: optionalYear(row.endYear),
            source: SOURCE,
          });
          touchedArtist = true;
          break;
        }
        case 'credential': {
          if (credentials.some(c => c.qualification === value)) continue;
          credentials.push({
            qualification: value,
            institution: row.role || undefined,
            year: optionalYear(row.startYear),
            source: SOURCE,
          });
          touchedArtist = true;
          break;
        }
        case 'work': {
          if (works.some(w => w.title === value)) continue;
          works.push({
            title: value,
            role: row.role || undefined,
            year: optionalYear(row.startYear),
            source: SOURCE,
          });
          touchedArtist = true;
          break;
        }
        case 'arangetram': {
          const year = optionalYear(row.startYear);
          if (year) proposedValues.arangetramYear = year;
          if (row.resolvedId) proposedValues.arangetramGuruId = row.resolvedId;
          // The venue rides the role column (see toProposals). Resolved by exact name only,
          // like the organisation branch below — nothing is created, so an unrecognised venue
          // is reported rather than invented. Dropping it silently, which this did, is worse
          // than either: the extractor asks for it and a reviewer accepting the row would
          // watch it vanish.
          if (row.role) {
            const venue = await Venue.getVenueByName(row.role);
            if (venue) {
              proposedValues.arangetramVenueId = venue.id;
            } else {
              console.warn(
                `  ${artist.name}: no venue named "${row.role}" — create it, then re-run`
              );
            }
          }
          if (year || row.resolvedId || proposedValues.arangetramVenueId) touchedArtist = true;
          break;
        }
        case 'affiliation': {
          // The junction requires a resolved Organiser — see the entity for why a blank
          // organiserId is not merely untidy but breaks the index. Nothing is auto-created
          // here, so an unresolved organisation is reported and left for a human.
          const organiser = await Organiser.getOrganiserByName(value);
          if (!organiser) {
            console.warn(
              `  ${artist.name}: no organisation named "${value}" — create it first, then re-run`
            );
            affiliationsSkipped++;
            continue;
          }
          if (dryRun) {
            console.log(
              `  [dry-run] ${artist.name} → ${organiser.name} (${row.role || 'no role'})`
            );
          } else {
            await ArtistAffiliation.addArtistAffiliation({
              artistId: artist.id,
              artistName: artist.name,
              organiserId: organiser.id,
              organisationName: organiser.name,
              role: row.role || undefined,
              startYear: optionalYear(row.startYear),
              endYear: optionalYear(row.endYear),
              isCurrent: row.relationship === 'current' || undefined,
              source: SOURCE,
            });
          }
          affiliationsWritten++;
          break;
        }
        // 'unresolved' rows are notes to the reviewer, never data. If one is marked accepted
        // it means the reviewer wanted to act on it by hand, not that it should be imported.
        default:
          break;
      }
    }

    if (!touchedArtist) continue;

    if (gurus.length !== (artist.gurus ?? []).length) proposedValues.gurus = gurus;
    if (credentials.length !== (artist.credentials ?? []).length) {
      proposedValues.credentials = credentials;
    }
    if (works.length !== (artist.works ?? []).length) proposedValues.works = works;

    if (Object.keys(proposedValues).length === 0) continue;

    // The dedup guards above compare against what is *stored*, and a submitted edit has not
    // been applied yet — so a second run of this script (having wondered whether the first
    // worked) would propose every one of these rows again and double the moderation queue.
    // One outstanding edit per artist is the limit; approve or reject it, then re-run.
    const active = await getActiveEditForEntity(userId, 'artist', artist.id);
    if (active) {
      console.log(`  ${artist.name}: edit ${active.id} is already open, skipped`);
      skippedOpenEdit++;
      continue;
    }

    if (dryRun) {
      console.log(
        `  [dry-run] ${artist.name}: draft with ${Object.keys(proposedValues).join(', ')}`
      );
      draftsCreated++;
      continue;
    }

    try {
      const draft = await createDraft({
        entityType: 'artist',
        entityId: artist.id,
        userId,
        proposedValues,
        operation: 'update',
        userNote: 'Imported from biography extraction. Review before approving.',
      });
      // Submitted, not left as a draft: a draft sits in one person's queue and is invisible to
      // the moderation surface, which is the whole point of routing through Edit.
      await submitEdit(draft.id, userId);
      draftsCreated++;
      console.log(`  ${artist.name}: edit ${draft.id} submitted`);
    } catch (error) {
      failures++;
      console.error(`  ${artist.name}: failed to create edit —`, error);
    }
  }

  console.log(`\n${draftsCreated} edits ${dryRun ? 'would be' : ''} submitted for moderation.`);
  console.log(`${affiliationsWritten} affiliations ${dryRun ? 'would be' : ''} written.`);
  if (affiliationsSkipped > 0) {
    console.log(`${affiliationsSkipped} affiliations skipped — the organisation does not exist.`);
  }
  if (skippedOpenEdit > 0) {
    console.log(
      `${skippedOpenEdit} artists skipped — an edit is already open. Moderate it, then re-run.`
    );
  }
  if (failures > 0) console.log(`${failures} artists failed.`);
  if (dryRun) console.log('\n[dry-run] Nothing was written.');
}
