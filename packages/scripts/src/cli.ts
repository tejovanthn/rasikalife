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

program.parseAsync(process.argv);
