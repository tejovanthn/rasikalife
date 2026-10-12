import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { shivkumar } from './shivkumar.js';
import type { SourceAdapter } from './types.js';

export type { SourceAdapter } from './types.js';

/** Every source the `source-*` commands know. Add an adapter here to import a new one. */
const ADAPTERS: Record<string, SourceAdapter> = {
  [shivkumar.name]: shivkumar,
};

export function getAdapter(name: string): SourceAdapter {
  const adapter = ADAPTERS[name];
  if (!adapter) {
    throw new Error(`Unknown source "${name}". Known: ${Object.keys(ADAPTERS).join(', ')}`);
  }
  return adapter;
}

/** Where a source's downloads and parsed records live (gitignored). */
export const sourceDir = (name: string) =>
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../data/sources', name);
