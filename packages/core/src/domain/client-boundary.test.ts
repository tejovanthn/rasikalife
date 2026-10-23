import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * A domain's `client.ts` is what the web app imports into browser code. Taking a *value* from
 * `./entity` there pulls the entity in, and with it ElectroDB and the AWS SDK: one constant
 * re-exported this way (COMPOSITION_TYPES) put ~106 kB gzipped into the browser bundle.
 * Types are erased and safe; a value has to live in a module with no imports.
 */
describe('client.ts browser boundary', () => {
  const domains = readdirSync(__dirname, { withFileTypes: true }).filter(d => d.isDirectory());

  it.each(domains.map(d => d.name))('%s/client.ts takes no value from ./entity', name => {
    let source: string;
    try {
      source = readFileSync(join(__dirname, name, 'client.ts'), 'utf8');
    } catch {
      return; // no client.ts
    }
    const valueFromEntity = source
      .split('\n')
      .filter(line => /from '\.\/entity'/.test(line))
      .filter(line => !/^\s*(export|import) type\b/.test(line));
    expect(valueFromEntity).toEqual([]);
  });
});
