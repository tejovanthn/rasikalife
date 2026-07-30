/**
 * Second pass: rewrites each artist's biography down to narrative only, now that its facts
 * live in structured fields.
 *
 * This is what takes a 500-word programme note to roughly 120 words of prose across the whole
 * corpus at once, and it fixes the register problem and the copied-text problem in a single
 * operation. Every rewrite lands as an `Edit` draft, so a moderator sees a diff of the old
 * text against the new before anything is published, and the original stays on the record
 * until they approve.
 *
 * ORDER MATTERS. This is safe only because extraction ran first — nothing is being deleted,
 * it is being relocated. An artist whose fields are still empty is skipped rather than
 * stripped, which is what `--min-fields` enforces.
 *
 * Usage: `pnpm cli rewrite-artist-bios --user <userId> [--dry-run] [--artist <id>] [--limit <n>]`
 */
// The edit service is exported flat, not under an `Edit` namespace — `Edit` itself is a type.
import { Artist, createDraft, submitEdit } from '@rasika/core';
import { rewriteBiography } from '@rasika/core/domain/artist/bio-extract';

const CALL_DELAY_MS = 250;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * How many populated structured fields an artist needs before their bio may be shortened.
 *
 * The guard rail for the whole operation. Rewriting a bio whose facts were never extracted
 * throws those facts away, and the prose is the only place they exist.
 */
const DEFAULT_MIN_FIELDS = 2;

/** The facts the model is told are already on the page, so it knows what to cut. */
function storedFactsFor(artist: Record<string, unknown>): Record<string, unknown> {
  return {
    gurus: artist.gurus ?? [],
    credentials: artist.credentials ?? [],
    works: artist.works ?? [],
    arangetramYear: artist.arangetramYear ?? null,
    birthYear: artist.birthYear ?? null,
    birthPlace: artist.birthPlace ?? null,
    city: artist.city ?? null,
    instrument: artist.instrument ?? null,
    activeYears: artist.activeYears ?? null,
    specialisations: artist.specialisations ?? [],
  };
}

function countPopulatedFields(facts: Record<string, unknown>): number {
  return Object.values(facts).filter(value =>
    Array.isArray(value) ? value.length > 0 : value !== null && value !== undefined && value !== ''
  ).length;
}

const wordCount = (text: string): number => (text.trim() ? text.trim().split(/\s+/).length : 0);

export async function rewriteArtistBios(opts: {
  userId: string;
  dryRun?: boolean;
  artistId?: string;
  limit?: number;
  minFields?: number;
}): Promise<void> {
  const { userId, dryRun = false, artistId, limit, minFields = DEFAULT_MIN_FIELDS } = opts;

  const all = await Artist.listAllArtistsForMatching();
  const withBios = artistId
    ? all.filter(a => a.id === artistId)
    : all.filter(a => typeof a.biography === 'string' && a.biography.trim().length > 0);
  const selected = limit ? withBios.slice(0, limit) : withBios;

  console.log(`${selected.length} artists with a biography.\n`);

  let rewritten = 0;
  let skippedThin = 0;
  let skippedShort = 0;
  let failures = 0;

  for (const [index, artist] of selected.entries()) {
    const biography = (artist.biography as string | undefined) ?? '';
    const label = `[${index + 1}/${selected.length}] ${artist.name}`;

    const facts = storedFactsFor(artist as unknown as Record<string, unknown>);
    const populated = countPopulatedFields(facts);
    if (populated < minFields) {
      // The important skip. Its facts are still only in the prose, so shortening it would
      // lose them outright.
      console.log(`${label}: only ${populated} fields populated — extract first, skipped`);
      skippedThin++;
      continue;
    }

    // Already short enough to be narrative rather than a programme note. Spending a model call
    // and a moderator's attention to shave a few words off is not worth it.
    if (wordCount(biography) <= 150) {
      skippedShort++;
      continue;
    }

    try {
      const rewrittenBio = await rewriteBiography(biography, facts);

      if (!rewrittenBio) {
        console.log(`${label}: nothing left after removing the fields, left alone`);
        skippedShort++;
        continue;
      }

      console.log(
        `${label}: ${wordCount(biography)} → ${wordCount(rewrittenBio)} words${dryRun ? ' [dry-run]' : ''}`
      );

      if (dryRun) {
        console.log(`  ${rewrittenBio}\n`);
        rewritten++;
        continue;
      }

      const draft = await createDraft({
        entityType: 'artist',
        entityId: artist.id,
        userId,
        proposedValues: { biography: rewrittenBio },
        operation: 'update',
        userNote:
          'Shortened to narrative only; the facts removed are stored as fields and render in their own sections.',
      });
      await submitEdit(draft.id, userId);
      rewritten++;
    } catch (error) {
      failures++;
      console.error(`${label}: FAILED —`, error);
    }

    if (index < selected.length - 1) await sleep(CALL_DELAY_MS);
  }

  console.log(`\n${rewritten} biographies ${dryRun ? 'would be' : ''} rewritten.`);
  console.log(
    `${skippedThin} skipped for having too few structured fields — run extraction first.`
  );
  console.log(`${skippedShort} skipped for already being short enough.`);
  if (failures > 0) console.log(`${failures} failed.`);
  if (dryRun) console.log('\n[dry-run] No edits were created.');
}
