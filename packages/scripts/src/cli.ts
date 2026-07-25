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
  .description('Delete duplicate ragas (same name + same data), keeping the oldest')
  .option('-n, --dry-run', 'Preview deletions without writing to the database')
  .action(async (opts: { dryRun?: boolean }) => {
    setup();
    const { dedupRagas } = await import('./dedupRagas.js');
    await dedupRagas({ dryRun: opts.dryRun });
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

program
  .command('rebuild-featured')
  .description("Backfill each artist's featured-performance list from isFeatured EventArtist rows")
  .option('-n, --dry-run', 'Preview changes without writing to the database')
  .option('--artist <id>', 'Rebuild featured performances for a single artist only')
  .action(async (opts: { dryRun?: boolean; artist?: string }) => {
    setup();
    const { rebuildFeatured } = await import('./rebuildFeatured.js');
    await rebuildFeatured({ dryRun: opts.dryRun, artistId: opts.artist });
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
