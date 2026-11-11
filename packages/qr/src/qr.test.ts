import { QR_BASE_URL } from '@rasika/core/domain/venue-qr/client';
import jsQR from 'jsqr';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it, vi } from 'vitest';
import { renderBatchJob } from './job';
import type { RenderDeps } from './job';
import { A4, STICKERS_PER_SHEET, pageCount, renderBatchPdf } from './layout';
import { qrMatrix, qrPath, qrUrl } from './qr-path';
import { Typesetter, flipPathY } from './typesetter';

const CODES = ['0123456Z', 'ABCDEFGH', 'JKMNPQRS', 'TVWXYZ01', 'HW4XHXGE'];

function decode(url: string): string | null {
  const matrix = qrMatrix(url);
  const scale = 8;
  const quiet = 4;
  const side = (matrix.size + quiet * 2) * scale;
  const data = new Uint8ClampedArray(side * side * 4).fill(255);
  for (let row = 0; row < matrix.size; row += 1) {
    for (let col = 0; col < matrix.size; col += 1) {
      if (!matrix.dark(row, col)) continue;
      for (let y = 0; y < scale; y += 1) {
        for (let x = 0; x < scale; x += 1) {
          const px = ((row + quiet) * scale + y) * side + (col + quiet) * scale + x;
          data[px * 4] = 0;
          data[px * 4 + 1] = 0;
          data[px * 4 + 2] = 0;
        }
      }
    }
  }
  return jsQR(data, side, side)?.data ?? null;
}

describe('qr matrix', () => {
  it('decodes back to the scan url for every code', () => {
    for (const code of CODES) {
      expect(decode(qrUrl(code, QR_BASE_URL))).toBe(`https://rasika.life/q/${code}`);
    }
  });

  it('draws the dark modules as merged runs of one path', () => {
    const matrix = qrMatrix('https://rasika.life/q/ABCDEFGH');
    const path = qrPath(matrix);
    expect(path.startsWith('M')).toBe(true);
    // Fewer runs than modules: horizontal neighbours are merged.
    const runs = (path.match(/M/g) ?? []).length;
    let dark = 0;
    for (let r = 0; r < matrix.size; r += 1) {
      for (let c = 0; c < matrix.size; c += 1) if (matrix.dark(r, c)) dark += 1;
    }
    expect(runs).toBeLessThan(dark);
  });
});

describe('flipPathY', () => {
  it('negates y and leaves x alone, without printing -0', () => {
    expect(flipPathY('M496,0L97,714Q1.5,-20,3,4Z')).toBe('M496,0L97,-714Q1.5,20,3,-4Z');
  });
});

describe('page counts', () => {
  it('packs four stickers per sheet and one tent or poster per code', () => {
    expect(STICKERS_PER_SHEET).toBe(4);
    expect(pageCount('sticker', 1)).toBe(1);
    expect(pageCount('sticker', 4)).toBe(1);
    expect(pageCount('sticker', 5)).toBe(2);
    expect(pageCount('sticker', 200)).toBe(50);
    expect(pageCount('table-tent', 200)).toBe(200);
    expect(pageCount('poster', 3)).toBe(3);
  });
});

describe('renderBatchPdf', () => {
  it('renders A4 pages for every format with the expected page count', async () => {
    const typesetter = await Typesetter.create();
    for (const format of ['sticker', 'table-tent', 'poster'] as const) {
      const bytes = await renderBatchPdf({
        format,
        codes: CODES,
        baseUrl: QR_BASE_URL,
        typesetter,
      });
      const doc = await PDFDocument.load(bytes);
      expect(doc.getPageCount()).toBe(pageCount(format, CODES.length));
      const { width, height } = doc.getPage(0).getSize();
      expect(width).toBeCloseTo(A4.w, 1);
      expect(height).toBeCloseTo(A4.h, 1);
    }
    typesetter.destroy();
  });

  it('measures Kannada through the shaper, so conjuncts are one cluster wide', async () => {
    const typesetter = await Typesetter.create();
    const wide = typesetter.width('ಸ್ಕ್ಯಾನ್', 'kannada', 20);
    expect(wide).toBeGreaterThan(20);
    // Shaped text is narrower than one advance per code point.
    const perCodePoint = [...'ಸ್ಕ್ಯಾನ್'].length * 20 * 0.6;
    expect(wide).toBeLessThan(perCodePoint);
    expect(
      typesetter.wrap('aaa bbb ccc', 'latin', 12, typesetter.width('aaa bbb', 'latin', 12) + 1)
    ).toEqual(['aaa bbb', 'ccc']);
    typesetter.destroy();
  });
});

describe('renderBatchJob', () => {
  function deps(over: Partial<RenderDeps> = {}): RenderDeps {
    return {
      getBatch: vi.fn().mockResolvedValue({ id: 'b1', format: 'poster' }),
      listCodes: vi.fn().mockResolvedValue(['ABCDEFGH']),
      putPdf: vi.fn().mockResolvedValue(undefined),
      setPdf: vi.fn().mockResolvedValue(undefined),
      typesetter: () => Typesetter.create(),
      baseUrl: QR_BASE_URL,
      ...over,
    };
  }

  it('uploads to qr-batches/{id}.pdf and marks the batch ready', async () => {
    const d = deps();
    expect(await renderBatchJob('b1', d)).toBe('ready');
    expect(d.putPdf).toHaveBeenCalledWith('qr-batches/b1.pdf', expect.any(Uint8Array));
    expect(d.setPdf).toHaveBeenCalledWith({
      id: 'b1',
      pdfStatus: 'ready',
      pdfKey: 'qr-batches/b1.pdf',
    });
  });

  it('marks the batch failed, and does not throw, when the upload fails', async () => {
    const d = deps({ putPdf: vi.fn().mockRejectedValue(new Error('s3 down')) });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(await renderBatchJob('b1', d)).toBe('failed');
    expect(d.setPdf).toHaveBeenCalledWith({ id: 'b1', pdfStatus: 'failed' });
  });

  it('does nothing for an unknown batch', async () => {
    const d = deps({ getBatch: vi.fn().mockResolvedValue(null) });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(await renderBatchJob('nope', d)).toBe('missing');
    expect(d.setPdf).not.toHaveBeenCalled();
  });
});

describe('200 code batch', () => {
  it('renders the slowest format (table tent) in well under 60 seconds', async () => {
    const typesetter = await Typesetter.create();
    const codes = Array.from({ length: 200 }, (_, i) =>
      `${String(i).padStart(3, '0')}ABCDE`.slice(0, 8)
    );
    for (const format of ['table-tent'] as const) {
      const started = Date.now();
      await renderBatchPdf({ format, codes, baseUrl: QR_BASE_URL, typesetter });
      expect(Date.now() - started).toBeLessThan(60_000);
    }
    typesetter.destroy();
  });
});
