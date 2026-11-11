import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Hb, HbFace, HbFont } from 'harfbuzzjs';
import type { PDFPage } from 'pdf-lib';
import { rgb } from 'pdf-lib';

/**
 * Text for print, shaped by HarfBuzz and drawn as vector outlines.
 *
 * Why not embed a font in pdf-lib: pdf-lib has no shaping of its own and leans on
 * `@pdf-lib/fontkit`, whose Indic shaper throws `regeneratorRuntime is not defined` on the
 * Kannada line in Node. Even with a polyfill, a PDF text object cannot carry the glyph
 * substitutions and mark positioning Kannada conjuncts need unless the shaper ran first.
 * HarfBuzz is the reference shaper; we ask it for glyph ids and positions, then fill each glyph's
 * outline. The PDF holds paths, not text, so there is nothing for a printer to substitute. The
 * cost is that the text cannot be selected or searched, which a printed sticker does not need.
 *
 * One variable font per script, read at the default width. `wght` is set per face.
 */
// harfbuzzjs is CommonJS and exports a promise. A plain import breaks under some loaders (vitest).
const hbPromise = createRequire(import.meta.url)('harfbuzzjs') as Promise<Hb>;

export type FaceName = 'latin' | 'latinBold' | 'kannada';

type Loaded = { font: HbFont; face: HbFace };

const FACE_FILES: Record<FaceName, { file: string; wght: number }> = {
  latin: { file: 'NotoSans.ttf', wght: 400 },
  latinBold: { file: 'NotoSans.ttf', wght: 700 },
  kannada: { file: 'NotoSansKannada.ttf', wght: 500 },
};

export function fontsDir(): string {
  return process.env.QR_FONTS_DIR ?? join(dirname(fileURLToPath(import.meta.url)), '..', 'fonts');
}

/** Flips a font-unit path (y up) into the y-down space that `drawSvgPath` expects. */
export function flipPathY(path: string): string {
  return path.replace(/(-?[\d.]+),(-?[\d.]+)/g, (_match, x: string, y: string) => {
    const flipped = -Number(y);
    return `${x},${Object.is(flipped, -0) ? 0 : flipped}`;
  });
}

export type DrawTextOptions = {
  face: FaceName;
  size: number;
  x: number;
  /** Baseline, in PDF points from the bottom of the page. */
  y: number;
  align?: 'left' | 'center' | 'right';
  /** Extra space between glyphs, in points. */
  tracking?: number;
  color?: [number, number, number];
};

export class Typesetter {
  private readonly faces = new Map<FaceName, Loaded>();
  private readonly pathCache = new Map<string, string>();

  private constructor(
    private readonly hb: Hb,
    private readonly data: Record<string, Uint8Array>
  ) {}

  static async create(dir: string = fontsDir()): Promise<Typesetter> {
    const hb = await hbPromise;
    const files = [...new Set(Object.values(FACE_FILES).map(f => f.file))];
    const data: Record<string, Uint8Array> = {};
    for (const file of files) data[file] = await readFile(join(dir, file));
    return new Typesetter(hb, data);
  }

  private load(name: FaceName): Loaded {
    const cached = this.faces.get(name);
    if (cached) return cached;
    const spec = FACE_FILES[name];
    const bytes = this.data[spec.file];
    if (!bytes) throw new Error(`Font ${spec.file} was not loaded`);
    const blob = this.hb.createBlob(bytes);
    const face = this.hb.createFace(blob, 0);
    const font = this.hb.createFont(face);
    font.setVariations({ wght: spec.wght });
    const loaded = { font, face };
    this.faces.set(name, loaded);
    return loaded;
  }

  private shape(text: string, name: FaceName) {
    const { font, face } = this.load(name);
    const buffer = this.hb.createBuffer();
    buffer.addText(text);
    buffer.guessSegmentProperties();
    this.hb.shape(font, buffer);
    const glyphs = buffer.json();
    buffer.destroy();
    return { glyphs, upem: face.upem, font };
  }

  /** Width in points, including tracking. */
  width(text: string, face: FaceName, size: number, tracking = 0): number {
    if (!text) return 0;
    const { glyphs, upem } = this.shape(text, face);
    const scale = size / upem;
    return glyphs.reduce((sum, g) => sum + g.ax * scale + tracking, 0) - tracking;
  }

  /** Largest size at or below `size` at which the text fits `maxWidth`. */
  fitSize(text: string, face: FaceName, size: number, maxWidth: number): number {
    const w = this.width(text, face, size);
    return w <= maxWidth ? size : (size * maxWidth) / w;
  }

  /** Greedy word wrap on spaces. A single word wider than the line stays on its own line. */
  wrap(text: string, face: FaceName, size: number, maxWidth: number): string[] {
    const lines: string[] = [];
    let line = '';
    for (const word of text.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (!line || this.width(next, face, size) <= maxWidth) {
        line = next;
      } else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  draw(page: PDFPage, text: string, options: DrawTextOptions): number {
    const { face, size, x, y, align = 'left', tracking = 0, color = [0, 0, 0] } = options;
    if (!text) return 0;
    const { glyphs, upem, font } = this.shape(text, face);
    const scale = size / upem;
    const total = glyphs.reduce((sum, g) => sum + g.ax * scale + tracking, 0) - tracking;
    let cursor = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
    const fill = rgb(color[0], color[1], color[2]);
    for (const g of glyphs) {
      const key = `${face}:${g.g}`;
      let path = this.pathCache.get(key);
      if (path === undefined) {
        path = flipPathY(font.glyphToPath(g.g));
        this.pathCache.set(key, path);
      }
      if (path) {
        page.drawSvgPath(path, {
          x: cursor + g.dx * scale,
          y: y + g.dy * scale,
          scale,
          color: fill,
          borderWidth: 0,
        });
      }
      cursor += g.ax * scale + tracking;
    }
    return total;
  }

  destroy(): void {
    for (const { font, face } of this.faces.values()) {
      font.destroy();
      face.destroy();
    }
    this.faces.clear();
  }
}
