import { Command } from 'commander';
import { Resource } from 'sst';

function setup() {
  process.env.DYNAMODB_TABLE = Resource.RasikaTable.name;
  process.env.SEARCH_INDEX_BUCKET = Resource.SearchIndexBucket.name;
}

const program = new Command();

program.name('rasika').description('Rasika.life admin CLI');

program
  .command('reindex')
  .description('Rebuild and store the search index')
  .action(async () => {
    setup();
    const { reindex } = await import('./reindex.js');
    await reindex();
  });

program
  .command('seed:content')
  .description('Seed static content pages (about, privacy, etc.)')
  .action(async () => {
    setup();
    const { seedContent } = await import('./addContent.js');
    await seedContent();
  });

program
  .command('seed:admin')
  .description('Promote a user to admin role')
  .argument('<email>', 'User email address')
  .action(async (email: string) => {
    setup();
    const { seedAdmin } = await import('./seed-admin.js');
    await seedAdmin(email);
  });

program
  .command('bulk-upload')
  .description('Bulk upload compositions from data/full-normalized.json')
  .option('-d, --drop', 'Drop all existing data before uploading')
  .argument('[limit]', 'Max compositions to process')
  .action(async (limit: string | undefined, opts: { drop?: boolean }) => {
    setup();
    const { bulkUpload } = await import('./bulkUpload.js');
    await bulkUpload({
      drop: opts.drop,
      limit: limit ? Number.parseInt(limit, 10) : undefined,
    });
  });

program
  .command('enrich-ragas')
  .description('Enrich raga entities from data/ragas.json')
  .option('-n, --dry-run', 'Preview changes without writing to the database')
  .action(async (opts: { dryRun?: boolean }) => {
    setup();
    const { enrichRagas } = await import('./enrichRagas.js');
    await enrichRagas({ dryRun: opts.dryRun });
  });

program
  .command('repair-uppercase-keys')
  .description('Repair rows damaged by the uppercase-key bug and delete the phantoms')
  .option('--apply', 'Write the repairs (default is a dry run)')
  .action(async (opts: { apply?: boolean }) => {
    setup();
    const { repairUppercaseKeys } = await import('./repairUppercaseKeys.js');
    await repairUppercaseKeys({ apply: opts.apply });
  });

program
  .command('dedup-ragas')
  .description('Find duplicate ragas for review, then merge the pairs marked in the CSV')
  .option('--apply', 'Merge the rows marked "merge" in --file, instead of reporting')
  .option('--file <path>', 'Reviewed CSV to apply', 'raga-duplicates.csv')
  .option('--out <path>', 'Where to write the report', 'raga-duplicates.csv')
  .option('-n, --dry-run', 'With --apply, list the merges without writing')
  .action(async (opts: { apply?: boolean; file: string; out: string; dryRun?: boolean }) => {
    setup();
    const mod = await import('./dedupRagas.js');
    if (opts.apply) {
      await mod.applyDuplicateRagaMerges({ file: opts.file, dryRun: opts.dryRun });
    } else {
      await mod.reportDuplicateRagas({ out: opts.out });
    }
  });

program
  .command('admin-csv-export')
  .description('Export a domain to the admin CSV, the same shape /admin/data/<domain> downloads')
  .requiredOption('--domain <name>', 'artist, raga, tala, composition, venue, organiser, ...')
  .requiredOption('--out <path>', 'Where to write the CSV')
  .action(async (opts: { domain: string; out: string }) => {
    setup();
    const { exportDomainCsv } = await import('./adminCsv.js');
    await exportDomainCsv(opts);
  });

program
  .command('admin-csv-import')
  .description('Land an edited admin CSV, blank cells meaning "leave alone"')
  .requiredOption('--domain <name>', 'artist, raga, tala, composition, venue, organiser, ...')
  .requiredOption('--file <path>', 'The edited CSV')
  .requiredOption('--user <id>', 'User id to attribute the writes to')
  .option('-n, --dry-run', 'Parse and report without writing')
  .action(async (opts: { domain: string; file: string; user: string; dryRun?: boolean }) => {
    setup();
    const { importDomainCsv } = await import('./adminCsv.js');
    await importDomainCsv({
      domain: opts.domain,
      file: opts.file,
      userId: opts.user,
      dryRun: opts.dryRun,
    });
  });

program
  .command('research-batches')
  .description('Write self-contained research packets for another agent to fill')
  .requiredOption('--domain <name>', 'raga (the only domain with a field list so far)')
  .requiredOption('--out-dir <dir>', 'Where to write the batch files')
  .option('--size <n>', 'Records per batch', (v: string) => Number.parseInt(v, 10), 25)
  .option('--all', 'Include records that already have every researched field')
  .option('--limit <n>', 'Only the first n records', (v: string) => Number.parseInt(v, 10))
  .action(
    async (opts: {
      domain: string;
      outDir: string;
      size: number;
      all?: boolean;
      limit?: number;
    }) => {
      setup();
      const { writeResearchBatches } = await import('./research.js');
      await writeResearchBatches({
        domain: opts.domain,
        outDir: opts.outDir,
        size: opts.size,
        onlyMissing: !opts.all,
        limit: opts.limit,
      });
    }
  );

program
  .command('research-ingest')
  .description('Validate returned research packets into an admin CSV, refusing what fails')
  .requiredOption('--domain <name>', 'The domain the batches were cut from')
  .requiredOption('--dir <dir>', 'Directory holding the *.result.json files')
  .requiredOption('--out <path>', 'Where to write the merged admin CSV')
  .option('--report <path>', 'Where to write the refusals as CSV')
  .action(async (opts: { domain: string; dir: string; out: string; report?: string }) => {
    setup();
    const { ingestResearch } = await import('./research.js');
    await ingestResearch(opts);
  });

program
  .command('admin-clear-fields')
  .description('Remove attributes outright, which a blank CSV cell cannot do')
  .requiredOption('--domain <name>', 'venue or organiser')
  .requiredOption('--id <id>', 'The record to correct')
  .requiredOption('--fields <list>', 'Comma-separated attribute names', (v: string) => v.split(','))
  .option('-n, --dry-run', 'Report what is set without removing it')
  .action(async (opts: { domain: string; id: string; fields: string[]; dryRun?: boolean }) => {
    setup();
    const { clearDomainFields } = await import('./adminCsv.js');
    await clearDomainFields(opts);
  });

program
  .command('dedup-places')
  .description('Find duplicate venues and organisers for review, then merge the pairs marked')
  .option('--apply', 'Merge the rows marked "merge" in --file, instead of reporting')
  .option('--file <path>', 'Reviewed CSV to apply', 'place-duplicates.csv')
  .option('--out <path>', 'Where to write the report', 'place-duplicates.csv')
  .option('-n, --dry-run', 'With --apply, list the merges without writing')
  .action(async (opts: { apply?: boolean; file: string; out: string; dryRun?: boolean }) => {
    setup();
    const mod = await import('./dedupPlaces.js');
    if (opts.apply) {
      await mod.applyDuplicatePlaceMerges({ file: opts.file, dryRun: opts.dryRun });
    } else {
      await mod.reportDuplicatePlaces({ out: opts.out });
    }
  });

program
  .command('rebuild-collaborators')
  .description('Rebuild artist collaborator lists from the approved event history')
  .option('-n, --dry-run', 'Preview changes without writing to the database')
  .option('--artist <id>', 'Rebuild collaborators for a single artist only')
  .action(async (opts: { dryRun?: boolean; artist?: string }) => {
    setup();
    const { rebuildCollaborators } = await import('./rebuildCollaborators.js');
    await rebuildCollaborators({ dryRun: opts.dryRun, artistId: opts.artist });
  });

program
  .command('rebuild-repertoire')
  .description("Rebuild each artist's most-performed repertoire from their events' setlists")
  .option('-n, --dry-run', 'Preview changes without writing to the database')
  .option('--artist <id>', 'Rebuild repertoire for a single artist only')
  .action(async (opts: { dryRun?: boolean; artist?: string }) => {
    setup();
    const { rebuildRepertoire } = await import('./rebuildRepertoire.js');
    await rebuildRepertoire({ dryRun: opts.dryRun, artistId: opts.artist });
  });

// The three steps of the bio-structuring pipeline, in the order they must run. Extraction
// seeds the fields; the import lands the reviewed rows; only then is the rewrite safe, because
// by that point nothing is being deleted, only relocated.
program
  .command('extract-artist-bios')
  .description('Extract structured facts from artist biographies into a CSV for review')
  .option('-n, --dry-run', 'Print the first rows instead of writing a file')
  .option('--artist <id>', 'Process a single artist only')
  .option('--limit <n>', 'Process at most this many artists', Number)
  .option('--out <path>', 'Where to write the CSV')
  .action(async (opts: { dryRun?: boolean; artist?: string; limit?: number; out?: string }) => {
    setup();
    const { extractArtistBios } = await import('./extractArtistBios.js');
    await extractArtistBios({
      dryRun: opts.dryRun,
      artistId: opts.artist,
      limit: opts.limit,
      out: opts.out,
    });
  });

program
  .command('import-bio-extractions')
  .description('Land reviewed bio-extraction rows as moderation edits and affiliation links')
  .requiredOption('--file <path>', 'The reviewed CSV, with the decision column filled in')
  .requiredOption('--user <id>', 'User id to attribute the edits to')
  .option('-n, --dry-run', 'Report what would be written without writing it')
  .action(async (opts: { file: string; user: string; dryRun?: boolean }) => {
    setup();
    const { importBioExtractions } = await import('./importBioExtractions.js');
    await importBioExtractions({ file: opts.file, userId: opts.user, dryRun: opts.dryRun });
  });

program
  .command('rewrite-artist-bios')
  .description('Shorten biographies to narrative only, once their facts are stored as fields')
  .requiredOption('--user <id>', 'User id to attribute the edits to')
  .option('-n, --dry-run', 'Print the rewrites without creating edits')
  .option('--artist <id>', 'Process a single artist only')
  .option('--limit <n>', 'Process at most this many artists', Number)
  .option(
    '--min-fields <n>',
    'Skip artists with fewer populated structured fields than this (default 2)',
    Number
  )
  .action(
    async (opts: {
      user: string;
      dryRun?: boolean;
      artist?: string;
      limit?: number;
      minFields?: number;
    }) => {
      setup();
      const { rewriteArtistBios } = await import('./rewriteArtistBios.js');
      await rewriteArtistBios({
        userId: opts.user,
        dryRun: opts.dryRun,
        artistId: opts.artist,
        limit: opts.limit,
        minFields: opts.minFields,
      });
    }
  );

program
  .command('backfill-photo-dimensions')
  .description('Store width and height on gallery photographs that have none')
  .option('-n, --dry-run', 'Report the measurements without writing them')
  .option('--artist <id>', 'Only this artist’s photographs')
  .option('--force', 'Re-measure photographs that already carry dimensions')
  .action(async (opts: { dryRun?: boolean; artist?: string; force?: boolean }) => {
    setup();
    const { backfillPhotoDimensions } = await import('./backfillPhotoDimensions.js');
    await backfillPhotoDimensions({
      dryRun: opts.dryRun,
      artistId: opts.artist,
      force: opts.force,
    });
  });

program
  .command('rebuild-featured')
  .description("Rebuild each artist's featured-performance list from live isFeatured rows")
  .option('-n, --dry-run', 'Preview changes without writing to the database')
  .action(async (opts: { dryRun?: boolean }) => {
    setup();
    const { rebuildFeatured } = await import('./rebuildFeatured.js');
    await rebuildFeatured({ dryRun: opts.dryRun });
  });

program
  .command('enrich-venues-organisers')
  .description('Fill venue and organiser fields derivable from the events already stored')
  .option('--apply', 'Write the fills (default is a dry run)')
  .option('--venues-only', 'Only touch venues')
  .option('--organisers-only', 'Only touch organisers')
  .action(async (opts: { apply?: boolean; venuesOnly?: boolean; organisersOnly?: boolean }) => {
    setup();
    const { enrichVenuesOrganisers } = await import('./enrichVenuesOrganisers.js');
    await enrichVenuesOrganisers({
      apply: opts.apply,
      venuesOnly: opts.venuesOnly,
      organisersOnly: opts.organisersOnly,
    });
  });

program
  .command('sync:instagram')
  .description(
    'Scrape Instagram profiles linked to artists, venues, and organisers for event posts'
  )
  .option('--handle <name>', 'Scrape a single Instagram handle')
  .option('-n, --dry-run', 'Show what would be scraped without writing to the database')
  .option('-r, --reprocess', 'Reprocess all posts (ignore previously seen post IDs)')
  .action(async (opts: { handle?: string; dryRun?: boolean; reprocess?: boolean }) => {
    setup();
    const { syncInstagram } = await import('./syncInstagram.js');
    await syncInstagram({ handle: opts.handle, dryRun: opts.dryRun, reprocess: opts.reprocess });
  });

program
  .command('backfill:webp')
  .description(
    'Convert existing S3 poster images to WebP (skips images that already have a .webp sibling)'
  )
  .option('-n, --dry-run', 'Preview conversions without writing to S3')
  .option('--prefix <prefix>', 'S3 key prefix to scan', 'posters/')
  .action(async (opts: { dryRun?: boolean; prefix?: string }) => {
    const { backfillWebp } = await import('./backfillWebp.js');
    await backfillWebp({ dryRun: opts.dryRun, prefix: opts.prefix });
  });

program
  .command('check:id')
  .description('Fetch raw entity data from the table by ID (tries all entity types)')
  .argument('<id>', 'Entity ID')
  .action(async (id: string) => {
    setup();
    const { checkEvent } = await import('./check-id.js');
    await checkEvent(id);
  });

program.parseAsync(process.argv);
