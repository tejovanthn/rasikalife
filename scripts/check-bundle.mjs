#!/usr/bin/env node
// Bundle every Lambda entry file the way SST does at deploy time, without
// writing output. Typecheck and tests do not bundle, so errors that only show
// up in the bundle (for example an ESM-only package with no default export)
// would otherwise pass CI and fail the prod deploy.
//
// Entry files are read from the `handler:` lines in infra/*.ts.
//   node scripts/check-bundle.mjs [file ...]   (default: all handlers in infra/)
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { build } from 'esbuild';

// Packages SST installs into the Lambda instead of bundling (see `nodejs.install`
// in infra/). Add native or binary packages here if bundling them fails.
const external = [
  'sharp',
  '@img/*',
  'harfbuzzjs',
  '@sparticuz/chromium',
  'puppeteer-core',
  'puppeteer-extra',
  'puppeteer-extra-plugin-stealth',
];

function infraHandlerFiles() {
  const files = new Set();
  for (const name of readdirSync('infra')) {
    if (!name.endsWith('.ts')) continue;
    const src = readFileSync(join('infra', name), 'utf8');
    for (const m of src.matchAll(/handler:\s*'([^']+)'/g)) {
      // 'packages/x/src/file.handler' -> 'packages/x/src/file.ts'
      const base = m[1].replace(/^\.\//, '').replace(/\.[A-Za-z0-9_]+$/, '');
      const file = ['.ts', '.tsx', '.js'].map(ext => base + ext).find(existsSync);
      if (!file) throw new Error(`Handler file not found for ${m[1]} (infra/${name})`);
      files.add(file);
    }
  }
  return [...files].sort();
}

const entryPoints = process.argv.length > 2 ? process.argv.slice(2) : infraHandlerFiles();
await build({
  entryPoints,
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  external,
  write: false,
  outdir: 'out',
  logLevel: 'error',
});
console.log(`Bundled ${entryPoints.length} Lambda entry files.`);
