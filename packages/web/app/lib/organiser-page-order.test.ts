import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Route components need a router and loaders to render, so this reads the source. It guards
// the order that was fixed: the concerts come before the biography and links.
describe('organiser page order', () => {
  const src = readFileSync(join(__dirname, '../routes/organisers.$organiserid.tsx'), 'utf8');
  const at = (text: string) => {
    const i = src.indexOf(text);
    expect(i, `${text} not found`).toBeGreaterThan(-1);
    return i;
  };

  it('puts Events before About, Focus Areas, Social Links and Artists', () => {
    const events = at('<h2 className="section-heading mb-6">Events</h2>');
    for (const later of [
      '>About</h2>',
      '>Focus Areas</h2>',
      '>Social Links</h2>',
      '>Artists</h2>',
    ]) {
      expect(events).toBeLessThan(at(later));
    }
  });

  it('puts Events after the contact lines', () => {
    expect(at('<h2 className="section-heading mb-6">Events</h2>')).toBeGreaterThan(
      at('Quick info')
    );
  });
});
