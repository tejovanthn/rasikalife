import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

/**
 * Generates the PWA icon set from an SVG wordmark.
 *
 * **These are placeholders.** The founder is supplying real brand assets; when they arrive,
 * replace `MARK` below and re-run `pnpm icons`. Everything downstream — the manifest, the
 * apple-touch icon, the splash screens — reads the generated files, so nothing else changes.
 *
 * The colours are the Rasika light-mode tokens resolved to hex, because a manifest cannot read
 * a CSS custom property. They are listed here rather than imported for that reason, and the
 * comment is the only thing keeping them honest.
 */
const BACKGROUND = '#ffe9e0'; // hsl(17 100% 95%) — --background, light
const INK = '#bd3c0f'; // hsl(17 84.7% 40%) — --primary, light

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '../public/icons');

/**
 * A maskable icon is cropped to whatever shape the platform likes — a circle on some Androids,
 * a squircle on others. Anything outside the middle 80% can be cut, so the mark sits well
 * inside that and the background runs to the edges.
 */
const MARK = size => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <rect width="100" height="100" fill="${BACKGROUND}"/>
  <g fill="none" stroke="${INK}" stroke-linecap="round" stroke-width="6">
    <path d="M32 68 V32 h14 a11 11 0 0 1 0 22 h-14"/>
    <path d="M46 54 L62 68"/>
  </g>
  <circle cx="68" cy="34" r="5" fill="${INK}"/>
</svg>`;

const SIZES = [192, 256, 384, 512];

mkdirSync(outDir, { recursive: true });

for (const size of SIZES) {
  const png = await sharp(Buffer.from(MARK(size)))
    .png()
    .toBuffer();
  writeFileSync(join(outDir, `icon-${size}.png`), png);
  writeFileSync(join(outDir, `maskable-${size}.png`), png);
}

// iOS ignores the manifest's icon list and reads `apple-touch-icon`. It also does not apply a
// mask, so this one is the same art at the size Safari asks for.
const apple = await sharp(Buffer.from(MARK(180)))
  .png()
  .toBuffer();
writeFileSync(join(outDir, 'apple-touch-icon.png'), apple);

/**
 * iOS splash screens, which the manifest also does not cover.
 *
 * Without them an installed app shows a white flash on every cold start, which reads as a
 * crash. One per common device size, since iOS matches on exact pixel dimensions and silently
 * ignores anything that does not match.
 */
const SPLASHES = [
  { w: 1170, h: 2532, name: 'splash-1170x2532.png' },
  { w: 1284, h: 2778, name: 'splash-1284x2778.png' },
  { w: 1179, h: 2556, name: 'splash-1179x2556.png' },
  { w: 1290, h: 2796, name: 'splash-1290x2796.png' },
];

for (const { w, h, name } of SPLASHES) {
  const mark = await sharp(Buffer.from(MARK(240)))
    .png()
    .toBuffer();
  const splash = await sharp({
    create: {
      width: w,
      height: h,
      channels: 4,
      background: BACKGROUND,
    },
  })
    .composite([{ input: mark, gravity: 'centre' }])
    .png()
    .toBuffer();
  writeFileSync(join(outDir, name), splash);
}

console.log(`Wrote ${SIZES.length * 2 + 1 + SPLASHES.length} placeholder icons to ${outDir}`);
