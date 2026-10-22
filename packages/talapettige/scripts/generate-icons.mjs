import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

/**
 * Generates the PWA icons and the favicon from one SVG: a tanpura seen from the front, its
 * round gourd and four strings, drawn in the Rasika light-mode tokens.
 *
 * The colours are the tokens resolved to hex, because a manifest cannot read a CSS custom
 * property. Keep them in step with `@rasika/ui/tokens.css` by hand.
 */
const BACKGROUND = '#ffe9e0'; // hsl(17 100% 95%) — --background, light
const INK = '#bd3c0f'; // hsl(17 84.7% 40%) — --primary, light

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = join(here, '../public');
const outDir = join(publicDir, 'icons');

// A maskable icon may be cropped to a circle, so the mark stays inside the middle 80%.
const MARK = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" fill="${BACKGROUND}"/>
  <g fill="none" stroke="${INK}" stroke-linecap="round">
    <circle cx="50" cy="64" r="18" stroke-width="5"/>
    <path d="M46 46 V18 M54 46 V18" stroke-width="5"/>
    <path d="M44 72 V22 M48 72 V22 M52 72 V22 M56 72 V22" stroke-width="1.2"/>
  </g>
  <circle cx="50" cy="18" r="4" fill="${INK}"/>
</svg>`;

mkdirSync(outDir, { recursive: true });

const png = size =>
  sharp(Buffer.from(MARK), { density: 72 * (size / 100) })
    .resize(size, size)
    .png()
    .toBuffer();

writeFileSync(join(outDir, 'icon-192.png'), await png(192));
writeFileSync(join(outDir, 'icon-512.png'), await png(512));
writeFileSync(join(outDir, 'maskable-512.png'), await png(512));
// iOS ignores the manifest and reads `apple-touch-icon`, at the size Safari asks for.
writeFileSync(join(outDir, 'apple-touch-icon.png'), await png(180));
writeFileSync(join(publicDir, 'favicon.svg'), `${MARK.trim()}\n`);

console.log(`Wrote icons to ${outDir} and favicon.svg`);
