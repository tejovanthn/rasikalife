import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AA_NON_TEXT, AA_NORMAL_TEXT, contrastRatio, hslToRgb } from './contrast';

/**
 * Reads the real tokens out of globals.css so this cannot pass against values the site does
 * not actually ship. Both blocks are parsed: `:root` for light, `:root[class~="dark"]` for
 * dark.
 */
function tokens(mode: 'light' | 'dark'): Record<string, [number, number, number]> {
  const css = readFileSync(join(__dirname, '../globals.css'), 'utf8');
  const start = css.indexOf(mode === 'light' ? ':root {' : ':root[class~="dark"]');
  expect(start, `${mode} block not found in globals.css`).toBeGreaterThan(-1);
  const block = css.slice(start, css.indexOf('}', start));

  const found: Record<string, [number, number, number]> = {};
  for (const [, name, h, s, l] of block.matchAll(
    /--([a-z-]+):\s*(-?[\d.]+)\s+([\d.]+)%\s+([\d.]+)%/g
  )) {
    found[name] = hslToRgb(Number(h), Number(s), Number(l));
  }
  return found;
}

/**
 * The pairs that actually appear on screen. `--primary` as link text was 2.97:1 in light
 * mode and white-on-primary was 3.38:1 on every filled button — both below AA — until the
 * light primary was darkened and the dark primary-foreground flipped. These assertions are
 * what stop either drifting back.
 */
describe.each(['light', 'dark'] as const)('%s theme token contrast', mode => {
  const t = tokens(mode);

  it('link text on the page background meets AA', () => {
    expect(contrastRatio(t.primary, t.background)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });

  it('button labels on a filled primary button meet AA', () => {
    expect(contrastRatio(t['primary-foreground'], t.primary)).toBeGreaterThanOrEqual(
      AA_NORMAL_TEXT
    );
  });

  it('body text on the page background meets AA', () => {
    expect(contrastRatio(t.foreground, t.background)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });

  it('secondary text meets AA on both the page and muted surfaces', () => {
    expect(contrastRatio(t['muted-foreground'], t.background)).toBeGreaterThanOrEqual(
      AA_NORMAL_TEXT
    );
    expect(contrastRatio(t['muted-foreground'], t.muted)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });

  it('destructive text meets AA on the page background', () => {
    expect(contrastRatio(t.destructive, t.background)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });

  // 1.4.11 Non-text Contrast: 3:1, not 4.5. The focus ring is the only thing telling a
  // keyboard user where they are, so it has to be visible against what surrounds it.
  it('the focus ring meets non-text contrast against the background', () => {
    expect(contrastRatio(t.ring, t.background)).toBeGreaterThanOrEqual(AA_NON_TEXT);
  });

  // Every filled surface that carries a label. White on --success was 2.30:1 in light mode,
  // and bg-success is what the moderator Approve buttons use, so the worst offender was on
  // an action rather than on decoration.
  it.each(['secondary', 'success', 'warning', 'destructive', 'accent', 'card', 'muted'])(
    'labels on a filled %s surface meet AA',
    role => {
      expect(contrastRatio(t[`${role}-foreground`], t[role])).toBeGreaterThanOrEqual(
        AA_NORMAL_TEXT
      );
    }
  );

  // The domain vocabulary from DESIGN.md section 2: each pale surface with its own deep ink.
  it.each(['raga', 'tala', 'language'])('the %s badge pairing meets AA', role => {
    expect(contrastRatio(t[`${role}-foreground`], t[role])).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });
});

// The palette is deliberately anchored to one warm hue (PRODUCT.md: "earthenware, temple
// stone"). Two tokens carried -21, which CSS normalises to 339 and renders rose, so every
// bg-muted surface sat off-brand without anything looking obviously broken.
describe.each(['light', 'dark'] as const)('%s theme hue discipline', mode => {
  it('keeps the surface tokens on the brand hue', () => {
    const css = readFileSync(join(__dirname, '../globals.css'), 'utf8');
    const start = css.indexOf(mode === 'light' ? ':root {' : ':root[class~="dark"]');
    const block = css.slice(start, css.indexOf('}', start));
    for (const [, name, h] of block.matchAll(/--([a-z-]+):\s*(-?[\d.]+)\s+[\d.]+%\s+[\d.]+%/g)) {
      expect(Number(h), `--${name} has a negative hue`).toBeGreaterThanOrEqual(0);
    }
  });
});
