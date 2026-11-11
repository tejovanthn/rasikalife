import type { QrFormat } from '@rasika/core/domain/qr-batch/client';
import {
  PDFDocument,
  concatTransformationMatrix,
  popGraphicsState,
  pushGraphicsState,
  rgb,
} from 'pdf-lib';
import type { PDFPage } from 'pdf-lib';
import { PANEL_COPY, STICKER_COPY, codeLine } from './copy';
import { qrMatrix, qrPath, qrUrl } from './qr-path';
import type { Typesetter } from './typesetter';

const MM = 72 / 25.4;
export const mm = (value: number): number => value * MM;

export const A4 = { w: mm(210), h: mm(297) };

/** Quiet zone, in modules, on every side of the symbol (spec: 4). */
export const QUIET_ZONE_MODULES = 4;

const GRAY: [number, number, number] = [0.3, 0.3, 0.3];

type Rect = { x: number; y: number; w: number; h: number };

/**
 * Draws the symbol inside a square box that includes the quiet zone. The box is white, so the
 * quiet zone stays clear even on a coloured sheet. `box` is the side in points; `x`, `top` is the
 * box's top left in PDF coordinates (`top` is measured up from the page bottom).
 */
export function drawQr(
  page: PDFPage,
  code: string,
  baseUrl: string,
  at: { x: number; top: number; box: number }
): void {
  const matrix = qrMatrix(qrUrl(code, baseUrl));
  const modules = matrix.size + QUIET_ZONE_MODULES * 2;
  const unit = at.box / modules;
  page.drawRectangle({
    x: at.x,
    y: at.top - at.box,
    width: at.box,
    height: at.box,
    color: rgb(1, 1, 1),
  });
  page.drawSvgPath(qrPath(matrix), {
    x: at.x + QUIET_ZONE_MODULES * unit,
    y: at.top - QUIET_ZONE_MODULES * unit,
    scale: unit,
    color: rgb(0, 0, 0),
    borderWidth: 0,
  });
}

type Paragraph = {
  text: string;
  face: 'latin' | 'latinBold' | 'kannada';
  size: number;
  /** Line height as a multiple of size. Kannada needs more room than Latin. */
  leading: number;
  color?: [number, number, number];
};

const LEADING = { latin: 1.3, latinBold: 1.25, kannada: 1.6 } as const;

/**
 * Draws wrapped, aligned lines from `top` downward and returns the top of the next block.
 * The first baseline sits one ascent (about 0.8 of the size) below `top`.
 */
function paragraph(
  page: PDFPage,
  type: Typesetter,
  p: Paragraph,
  area: { x: number; width: number; top: number; align: 'left' | 'center' }
): number {
  const lines = type.wrap(p.text, p.face, p.size, area.width);
  let top = area.top;
  for (const line of lines) {
    // A single long word may not wrap; shrink that line rather than spill off the face.
    const size = Math.min(p.size, type.fitSize(line, p.face, p.size, area.width));
    type.draw(page, line, {
      face: p.face,
      size,
      x: area.align === 'center' ? area.x + area.width / 2 : area.x,
      y: top - p.size * 0.82,
      align: area.align,
      color: p.color,
    });
    top -= p.size * p.leading;
  }
  return top;
}

export type FaceInput = { code: string; baseUrl: string };

/** Sticker face, 100 x 100 mm. `rect` is its position on the sheet. */
function stickerFace(page: PDFPage, type: Typesetter, input: FaceInput, rect: Rect): void {
  const pad = mm(4);
  const innerW = rect.w - pad * 2;
  const x = rect.x + pad;
  const top = rect.y + rect.h;

  let cursor = paragraph(
    page,
    type,
    { text: STICKER_COPY.headline, face: 'latinBold', size: 17, leading: LEADING.latinBold },
    { x, width: innerW, top: top - mm(4.5), align: 'center' }
  );
  cursor = paragraph(
    page,
    type,
    { text: STICKER_COPY.kannada, face: 'kannada', size: 11.5, leading: LEADING.kannada },
    { x, width: innerW, top: cursor - mm(0.5), align: 'center' }
  );

  const box = mm(64);
  const qrTop = cursor - mm(0.5);
  drawQr(page, input.code, input.baseUrl, { x: rect.x + (rect.w - box) / 2, top: qrTop, box });

  const codeBaseline = qrTop - box - mm(0.5);
  type.draw(page, codeLine(input.code), {
    face: 'latinBold',
    size: 11,
    x: rect.x + rect.w / 2,
    y: codeBaseline - 9,
    align: 'center',
    tracking: 0.5,
  });
  type.draw(page, STICKER_COPY.footer, {
    face: 'latin',
    size: 9,
    x: rect.x + rect.w / 2,
    y: rect.y + mm(4.5),
    align: 'center',
    color: GRAY,
  });
}

/** Table tent face: A5 landscape on a half of A4 (210 x 148.5 mm). QR left, words right. */
function tentFace(page: PDFPage, type: Typesetter, input: FaceInput, rect: Rect): void {
  const pad = mm(10);
  const top = rect.y + rect.h;
  const box = mm(94);
  const qrX = rect.x + pad;
  const qrTop = top - mm(14);
  drawQr(page, input.code, input.baseUrl, { x: qrX, top: qrTop, box });
  type.draw(page, codeLine(input.code), {
    face: 'latinBold',
    size: 13,
    x: qrX + box / 2,
    y: qrTop - box - 14,
    align: 'center',
    tracking: 0.6,
  });
  type.draw(page, PANEL_COPY.footer, {
    face: 'latin',
    size: 10,
    x: qrX + box / 2,
    y: rect.y + mm(8),
    align: 'center',
    color: GRAY,
  });

  const colX = qrX + box + mm(6);
  const colW = rect.x + rect.w - pad - colX;
  let cursor = top - mm(16);
  cursor = paragraph(
    page,
    type,
    { text: PANEL_COPY.headline, face: 'latinBold', size: 24, leading: 1.2 },
    { x: colX, width: colW, top: cursor, align: 'left' }
  );
  cursor = paragraph(
    page,
    type,
    { text: PANEL_COPY.body, face: 'latin', size: 11.5, leading: LEADING.latin },
    { x: colX, width: colW, top: cursor - mm(2), align: 'left' }
  );
  cursor = paragraph(
    page,
    type,
    { text: PANEL_COPY.kannada, face: 'kannada', size: 12, leading: LEADING.kannada },
    { x: colX, width: colW, top: cursor - mm(2), align: 'left' }
  );
  paragraph(
    page,
    type,
    { text: PANEL_COPY.reassurance, face: 'latinBold', size: 13, leading: LEADING.latinBold },
    { x: colX, width: colW, top: cursor - mm(2), align: 'left' }
  );
}

/** Poster face, A4 portrait, everything centred. */
function posterFace(page: PDFPage, type: Typesetter, input: FaceInput, rect: Rect): void {
  const pad = mm(16);
  const width = rect.w - pad * 2;
  const x = rect.x + pad;
  const top = rect.y + rect.h;

  let cursor = paragraph(
    page,
    type,
    { text: PANEL_COPY.headline, face: 'latinBold', size: 40, leading: 1.2 },
    { x, width, top: top - mm(18), align: 'center' }
  );
  cursor = paragraph(
    page,
    type,
    { text: PANEL_COPY.body, face: 'latin', size: 17, leading: LEADING.latin },
    { x, width, top: cursor - mm(4), align: 'center' }
  );
  cursor = paragraph(
    page,
    type,
    { text: PANEL_COPY.kannada, face: 'kannada', size: 18, leading: LEADING.kannada },
    { x, width, top: cursor - mm(3), align: 'center' }
  );

  const box = mm(120);
  const qrTop = cursor - mm(6);
  drawQr(page, input.code, input.baseUrl, { x: rect.x + (rect.w - box) / 2, top: qrTop, box });
  type.draw(page, codeLine(input.code), {
    face: 'latinBold',
    size: 20,
    x: rect.x + rect.w / 2,
    y: qrTop - box - 20,
    align: 'center',
    tracking: 1,
  });
  paragraph(
    page,
    type,
    { text: PANEL_COPY.reassurance, face: 'latinBold', size: 20, leading: LEADING.latinBold },
    { x, width, top: qrTop - box - mm(14), align: 'center' }
  );
  type.draw(page, PANEL_COPY.footer, {
    face: 'latin',
    size: 14,
    x: rect.x + rect.w / 2,
    y: rect.y + mm(12),
    align: 'center',
    color: GRAY,
  });
}

/** Draws `fn` turned half a circle about the centre of `rect`. */
function rotated180(page: PDFPage, rect: Rect, fn: () => void): void {
  page.pushOperators(
    pushGraphicsState(),
    concatTransformationMatrix(-1, 0, 0, -1, rect.x * 2 + rect.w, rect.y * 2 + rect.h)
  );
  fn();
  page.pushOperators(popGraphicsState());
}

const MARK_LEN = mm(4);
const MARK_GAP = mm(1.5);
const MARK_COLOR = rgb(0, 0, 0);

function line(page: PDFPage, x1: number, y1: number, x2: number, y2: number): void {
  page.drawLine({
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
    thickness: 0.4,
    color: MARK_COLOR,
  });
}

/** Marks at every grid line, outside the block, so one straight cut serves two stickers. */
function stickerCropMarks(page: PDFPage, grid: Rect, cell: number, cols: number, rows: number) {
  for (let c = 0; c <= cols; c += 1) {
    const x = grid.x + c * cell;
    line(page, x, grid.y - MARK_GAP, x, grid.y - MARK_GAP - MARK_LEN);
    line(page, x, grid.y + grid.h + MARK_GAP, x, grid.y + grid.h + MARK_GAP + MARK_LEN);
  }
  for (let r = 0; r <= rows; r += 1) {
    const y = grid.y + r * cell;
    line(page, grid.x - MARK_GAP, y, grid.x - MARK_GAP - MARK_LEN, y);
    line(page, grid.x + grid.w + MARK_GAP, y, grid.x + grid.w + MARK_GAP + MARK_LEN, y);
  }
}

/** Stickers per A4 sheet: a 2 x 2 block, centred, with crop marks. */
export const STICKERS_PER_SHEET = 4;

function stickerSheet(doc: PDFDocument, type: Typesetter, codes: string[], baseUrl: string) {
  const cell = mm(100);
  const grid: Rect = {
    x: (A4.w - cell * 2) / 2,
    y: (A4.h - cell * 2) / 2,
    w: cell * 2,
    h: cell * 2,
  };
  const page = doc.addPage([A4.w, A4.h]);
  stickerCropMarks(page, grid, cell, 2, 2);
  codes.forEach((code, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    // Row 0 is the top row of the block.
    const rect: Rect = {
      x: grid.x + col * cell,
      y: grid.y + (1 - row) * cell,
      w: cell,
      h: cell,
    };
    stickerFace(page, type, { code, baseUrl }, rect);
  });
}

/**
 * Table tent: one A4 sheet folded across its width. The upper half is turned half a circle so
 * that, once folded and stood up, both faces read the right way up and carry the same face.
 */
function tentSheet(doc: PDFDocument, type: Typesetter, code: string, baseUrl: string) {
  const page = doc.addPage([A4.w, A4.h]);
  const half = A4.h / 2;
  const lower: Rect = { x: 0, y: 0, w: A4.w, h: half };
  const upper: Rect = { x: 0, y: half, w: A4.w, h: half };
  tentFace(page, type, { code, baseUrl }, lower);
  rotated180(page, upper, () => tentFace(page, type, { code, baseUrl }, upper));

  // Fold ticks at both edges, and trim ticks in the four corners.
  line(page, 0, half, mm(6), half);
  line(page, A4.w - mm(6), half, A4.w, half);
  const inset = mm(4);
  const tick = mm(4);
  for (const [cx, cy, dx, dy] of [
    [inset, inset, 1, 1],
    [A4.w - inset, inset, -1, 1],
    [inset, A4.h - inset, 1, -1],
    [A4.w - inset, A4.h - inset, -1, -1],
  ] as const) {
    line(page, cx, cy, cx + dx * tick, cy);
    line(page, cx, cy, cx, cy + dy * tick);
  }
}

function posterSheet(doc: PDFDocument, type: Typesetter, code: string, baseUrl: string) {
  const page = doc.addPage([A4.w, A4.h]);
  posterFace(page, type, { code, baseUrl }, { x: 0, y: 0, w: A4.w, h: A4.h });
}

/** Pages a batch of `count` codes takes in a format. */
export function pageCount(format: QrFormat, count: number): number {
  return format === 'sticker' ? Math.ceil(count / STICKERS_PER_SHEET) : count;
}

/**
 * Renders a whole batch. The code order is the order given: the batch page and the PDF agree
 * because the caller sorts once.
 */
export async function renderBatchPdf(input: {
  format: QrFormat;
  codes: string[];
  baseUrl: string;
  typesetter: Typesetter;
  title?: string;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  if (input.title) doc.setTitle(input.title);
  doc.setCreator('rasika.life');

  if (input.format === 'sticker') {
    for (let i = 0; i < input.codes.length; i += STICKERS_PER_SHEET) {
      stickerSheet(
        doc,
        input.typesetter,
        input.codes.slice(i, i + STICKERS_PER_SHEET),
        input.baseUrl
      );
    }
  } else {
    for (const code of input.codes) {
      if (input.format === 'table-tent') tentSheet(doc, input.typesetter, code, input.baseUrl);
      else posterSheet(doc, input.typesetter, code, input.baseUrl);
    }
  }
  return doc.save();
}
