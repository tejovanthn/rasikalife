import { readFileSync, writeFileSync } from 'node:fs';
import { AdminData } from '@rasika/core';
import { domainToCsv, parseDomainCsv } from '@rasika/core/admin/columns';

/**
 * The admin CSV export/import from the command line, over the same registry the
 * `/admin/data/<domain>` route uses — `listAllForDomain` and `bulkUpsertForDomain`, so the
 * two paths cannot validate differently.
 *
 * The route is still the ordinary way to do this. This exists for a bulk pass against prod,
 * where three things the browser flow does not give matter: a dry run that parses and
 * reports without writing, every row error printed rather than the first few, and a file on
 * disk that a script can build. The venue and organiser enrichment was landed this way.
 *
 * Blank cells mean "leave alone", which is the registry's rule and the reason a re-import of
 * an untouched export is a no-op.
 */

export async function exportDomainCsv(opts: { domain: string; out: string }): Promise<void> {
  const rows = await AdminData.listAllForDomain(opts.domain);
  writeFileSync(opts.out, domainToCsv(opts.domain, rows as Record<string, unknown>[]), 'utf-8');
  console.log(`📤 Exported ${rows.length} ${opts.domain} rows to ${opts.out}`);
}

export async function importDomainCsv(opts: {
  domain: string;
  file: string;
  userId: string;
  dryRun?: boolean;
}): Promise<void> {
  const { domain, file, userId, dryRun = false } = opts;
  const parsed = parseDomainCsv(domain, readFileSync(file, 'utf-8'));

  console.log(`📋 ${parsed.rows.length} rows parsed, ${parsed.errors.length} parse errors`);
  for (const error of parsed.errors) console.log(`  ⚠️  ${error}`);

  // A parse error means a cell the registry could not read at all. Landing the rest would
  // write a partial edit and report success, so the run stops instead.
  if (parsed.errors.length > 0) {
    console.log('\nFix the cells above and run again. Nothing was written.');
    return;
  }
  if (dryRun) {
    const withId = parsed.rows.filter(row => typeof row.id === 'string' && row.id.trim()).length;
    console.log(`[dry-run] ${withId} would update, ${parsed.rows.length - withId} would create`);
    return;
  }

  const result = await AdminData.bulkUpsertForDomain(domain, parsed.rows, userId);
  console.log(`\n🎉 created ${result.created}, updated ${result.updated}`);
  for (const error of result.errors) {
    console.error(
      `  ❌ row ${error.index}${error.name ? ` (${error.name})` : ''}: ${error.message}`
    );
  }
  if (result.errors.length === 0) console.log('No row errors. Reindex search next.');
}
