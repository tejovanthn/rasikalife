import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AA_NORMAL_TEXT, contrastRatio, hslToRgb } from './contrast';

/**
 * Every badge tone, in both themes, read off the component rather than restated here.
 *
 * `contrast.test.ts` next door asserts solid token pairs from `globals.css`, and that is exactly
 * why the badges got through it: they were **alpha composites** — `bg-primary/15 text-primary` —
 * a shape it cannot see. The primary badge shipped at 3.46:1 in light mode, and the success and
 * warning badges sat at 1.31:1 and 1.50:1 in dark.
 *
 * So this parses `badgeTones` out of the component and converts `bg-x`/`text-y` back to `--x` /
 * `--y`. Two consequences worth keeping: a tone added without a contrast check fails here
 * automatically, and an alpha reintroduced is composited over both surfaces and checked rather
 * than skipped.
 *
 * It lives in packages/web because that is where the contrast maths and the CSS parsing already
 * are, and where `token-drift.test.ts` already reaches across into packages/ui.
 */
const UI_TOKENS = join(__dirname, '../../../ui/src/tokens.css');
const BADGE_COMPONENT = join(__dirname, '../../../ui/src/components/card.tsx');

type Rgb = [number, number, number];

function parseTokens(css: string): { light: Record<string, Rgb>; dark: Record<string, Rgb> } {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const root = withoutComments.match(/:root\s*\{([^}]*)\}/)?.[1] ?? '';
  const dark =
    withoutComments.match(/\.dark\s*,\s*:root\[class~="dark"\]\s*\{([^}]*)\}/)?.[1] ?? '';

  const read = (body: string): Record<string, Rgb> => {
    const out: Record<string, Rgb> = {};
    for (const line of body.split(';')) {
      const m = line.match(/(--[\w-]+)\s*:\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%/);
      if (m?.[1]) {
        out[m[1]] = hslToRgb(Number(m[2]), Number(m[3]), Number(m[4]));
      }
    }
    return out;
  };

  return { light: read(root), dark: read(dark) };
}

/** `bg-primary/15` → `{ token: '--primary', alpha: 0.15 }`. */
function readClass(cls: string, prefix: 'bg' | 'text'): { token: string; alpha: number } | null {
  const m = cls.match(new RegExp(`^${prefix}-([a-z-]+)(?:/(\\d+))?$`));
  if (!m?.[1]) {
    return null;
  }
  return { token: `--${m[1]}`, alpha: m[2] ? Number(m[2]) / 100 : 1 };
}

function parseTones(source: string): Record<string, { bg: string; fg: string }> {
  const block = source.match(/const badgeTones = \{([\s\S]*?)\} as const;/)?.[1] ?? '';
  const tones: Record<string, { bg: string; fg: string }> = {};
  for (const line of block.split('\n')) {
    const m = line.match(/(\w+):\s*'([^']+)'/);
    if (m?.[1] && m[2]) {
      const classes = m[2].split(/\s+/);
      const bg = classes.find(c => c.startsWith('bg-'));
      const fg = classes.find(c => c.startsWith('text-'));
      if (bg && fg) {
        tones[m[1]] = { bg, fg };
      }
    }
  }
  return tones;
}

/** Alpha over an opaque surface, the way a browser composites it. */
function composite(tint: Rgb, alpha: number, surface: Rgb): Rgb {
  return [0, 1, 2].map(i => tint[i] * alpha + surface[i] * (1 - alpha)) as Rgb;
}

const tokens = parseTokens(readFileSync(UI_TOKENS, 'utf8'));
const tones = parseTones(readFileSync(BADGE_COMPONENT, 'utf8'));

describe('badge tones', () => {
  it('found the tone map, so a rename cannot make this test vacuous', () => {
    expect(Object.keys(tones).length).toBeGreaterThanOrEqual(5);
    expect(Object.keys(tokens.light).length).toBeGreaterThan(20);
  });

  for (const [name, { bg, fg }] of Object.entries(tones)) {
    for (const mode of ['light', 'dark'] as const) {
      /**
       * A badge is `text-xs` — small text — so the 3:1 large-text allowance never applies to it.
       * Checked over `--card` and `--background` both, because a badge sits on either.
       */
      it(`${name} clears AA in ${mode} mode`, () => {
        const palette = tokens[mode];
        const background = readClass(bg, 'bg');
        const foreground = readClass(fg, 'text');
        expect(background, `unparseable background class: ${bg}`).not.toBeNull();
        expect(foreground, `unparseable text class: ${fg}`).not.toBeNull();

        const tint = palette[background?.token ?? ''];
        const text = palette[foreground?.token ?? ''];
        expect(tint, `missing token ${background?.token}`).toBeDefined();
        expect(text, `missing token ${foreground?.token}`).toBeDefined();

        for (const surfaceToken of ['--card', '--background']) {
          const surface = palette[surfaceToken];
          const filled = composite(tint, background?.alpha ?? 1, surface);
          const ratio = contrastRatio(text, filled);
          expect(
            ratio,
            `${name} on ${surfaceToken} in ${mode}: ${ratio.toFixed(2)}:1`
          ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
        }
      });
    }
  }
});
