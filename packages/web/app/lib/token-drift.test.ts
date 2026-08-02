import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The colour tokens live in two files, and this is what stops them drifting.
 *
 * `app/globals.css` is the source for this app, and `contrast.test.ts` parses it directly to
 * assert every on-screen pair against WCAG AA. `packages/ui/src/tokens.css` is what Rasika
 * Classes loads. Neither can import the other: moving the values out of `globals.css` would
 * disarm the contrast test, which is the thing that caught 2.97:1 links and 2.19:1 error text.
 *
 * So they are copies, and this test makes a copy that has fallen behind fail loudly rather than
 * ship as two apps in slightly different colours.
 */
const CSS_ROOT = join(__dirname, '..');
const UI_TOKENS = join(CSS_ROOT, '../../ui/src/tokens.css');

type Tokens = Record<string, string>;

function parseBlocks(css: string): { light: Tokens; dark: Tokens; preferred: Tokens } {
  const light: Tokens = {};
  const dark: Tokens = {};
  const preferred: Tokens = {};

  // Strip comments first: several token values carry a paragraph of reasoning above them, and
  // one of those comments contains a colon-and-number that would otherwise parse as a token.
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');

  const rootMatch = withoutComments.match(/:root\s*\{([^}]*)\}/);
  const darkMatch = withoutComments.match(/\.dark\s*,\s*:root\[class~="dark"\]\s*\{([^}]*)\}/);
  // The `prefers-color-scheme` block, which only packages/ui has — see its comment for why web
  // deliberately does not.
  const preferredMatch = withoutComments.match(
    /@media \(prefers-color-scheme: dark\)\s*\{\s*:root[^{]*\{([^}]*)\}/
  );

  for (const [body, target] of [
    [rootMatch?.[1] ?? '', light],
    [darkMatch?.[1] ?? '', dark],
    [preferredMatch?.[1] ?? '', preferred],
  ] as const) {
    for (const line of body.split(';')) {
      const declaration = line.match(/(--[\w-]+)\s*:\s*(.+)/);
      if (declaration?.[1] && declaration[2]) {
        target[declaration[1]] = declaration[2].trim();
      }
    }
  }

  return { light, dark, preferred };
}

describe('design token drift', () => {
  const web = parseBlocks(readFileSync(join(CSS_ROOT, 'globals.css'), 'utf8'));
  const ui = parseBlocks(readFileSync(UI_TOKENS, 'utf8'));

  it('parsed something, so a rename cannot make this test vacuous', () => {
    expect(Object.keys(web.light).length).toBeGreaterThan(20);
    expect(Object.keys(ui.light).length).toBeGreaterThan(20);
  });

  it('defines the same tokens in both files', () => {
    expect(Object.keys(ui.light).sort()).toEqual(Object.keys(web.light).sort());
    expect(Object.keys(ui.dark).sort()).toEqual(Object.keys(web.dark).sort());
  });

  it('gives every token the same value in light mode', () => {
    expect(ui.light).toEqual(web.light);
  });

  it('gives every token the same value in dark mode', () => {
    expect(ui.dark).toEqual(web.dark);
  });

  // Light and dark being the same value is what produced 2.97:1 links and 2.19:1 error text.
  // If the two files ever agree on this, one of them has been flattened.
  it('keeps light and dark apart on the tokens that must differ', () => {
    for (const token of ['--primary', '--destructive', '--primary-foreground']) {
      expect(ui.light[token]).not.toEqual(ui.dark[token]);
    }
  });

  /**
   * The third copy. CSS has no way to alias a selector into a media query, so the dark palette
   * is written twice in `packages/ui/src/tokens.css`: once for an explicit `.dark` class and
   * once for `prefers-color-scheme`. Only the second is reachable in Rasika Classes today, which
   * is precisely the sort of asymmetry that rots — a value corrected in the class block and not
   * the media block would leave the app rendering the old one with nothing to show for it.
   */
  it('gives the prefers-color-scheme block the same values as the dark class', () => {
    expect(Object.keys(ui.preferred).length).toBeGreaterThan(20);
    expect(ui.preferred).toEqual(ui.dark);
  });

  // packages/web has an explicit toggle backed by a cookie; a media query there would fight it.
  it('does not add a prefers-color-scheme block to the app that has a toggle', () => {
    expect(Object.keys(web.preferred)).toHaveLength(0);
  });
});
