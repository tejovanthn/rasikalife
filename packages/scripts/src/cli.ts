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
  .command('dedup-ragas')
  .description('Delete duplicate ragas (same name + same data), keeping the oldest')
  .option('-n, --dry-run', 'Preview deletions without writing to the database')
  .action(async (opts: { dryRun?: boolean }) => {
    setup();
    const { dedupRagas } = await import('./dedupRagas.js');
    await dedupRagas({ dryRun: opts.dryRun });
  });

program.parseAsync(process.argv);
