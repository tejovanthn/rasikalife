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
import { COLOR } from './palette';
import type { Rgb } from './palette';
import { qrMatrix, qrPath, qrUrl } from './qr-path';
import type { Typesetter } from './typesetter';

const MM = 72 / 25.4;
export const mm = (value: number): number => value * MM;

export const A4 = { w: mm(210), h: mm(297) };

/** Quiet zone, in modules, on every side of the symbol (spec: 4). */
export const QUIET_ZONE_MODULES = 4;

/** Every face runs 3 mm past its trim line. Text and the QR panel stay 5 mm inside it. */
export const BLEED_MM = 3;
export const SAFE_MM = 5;
/**
 * Paper outside the bleed, on every side of a tent or poster page and of the sticker block.
 * Crop marks live here: 1.5 mm clear of the bleed, 4 mm long, so 8.5 mm of the 9.
 */
export const SLUG_MM = 9;
const MARK_GAP_MM = 1.5;
const MARK_LEN_MM = 4;

type Rect = { x: number; y: number; w: number; h: number };
/** How far the background and band run past each trim edge, in points. */
type Bleed = { left: number; right: number; top: number; bottom: number };

const fill = (c: Rgb) => rgb(c[0], c[1], c[2]);

/**
 * Draws the symbol on a warm white panel. The panel is the box, and the 4 module quiet zone lies
 * inside it. Modules are lamp black and never take any other colour. `box` is the side in points;
 * `x`, `top` is the panel's top left in PDF coordinates.
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
    color: fill(COLOR.warmWhite),
  });
  page.drawSvgPath(qrPath(matrix), {
    x: at.x + QUIET_ZONE_MODULES * unit,
    y: at.top - QUIET_ZONE_MODULES * unit,
    scale: unit,
    color: fill(COLOR.lampBlack),
    borderWidth: 0,
  });
}

type Paragraph = {
  text: string;
  face: 'latin' | 'latinBold' | 'kannada';
  size: number;
  /** Line height as a multiple of size. Kannada needs more room than Latin. */
  leading: number;
  color?: Rgb;
};

const LEADING = { latin: 1.3, latinBold: 1.25, kannada: 1.6 } as const;

/**
 * Draws wrapped, aligned lines from `top` downward and returns the top of the next block.
 * The first baseline sits one ascent (about 0.8 of the size) below `top`. Text is ink unless told.
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
      color: p.color ?? COLOR.ink,
    });
    top -= p.size * p.leading;
  }
  return top;
}

export type FaceInput = { code: string; baseUrl: string };

/** Fills the whole face, bleed included, with hall light. */
function paintBackground(page: PDFPage, rect: Rect, bleed: Bleed): void {
  page.drawRectangle({
    x: rect.x - bleed.left,
    y: rect.y - bleed.bottom,
    width: rect.w + bleed.left + bleed.right,
    height: rect.h + bleed.top + bleed.bottom,
    color: fill(COLOR.hallLight),
  });
}

/**
 * The fired earthenware band across the top of a face, with the headline in warm white. The band
 * is sized to the headline: `topPad` above its first line, `bottomPad` under its last. It runs to
 * the top and side bleed. Returns the band's bottom edge (PDF y) so body text can start below it.
 */
function headlineBand(
  page: PDFPage,
  type: Typesetter,
  rect: Rect,
  bleed: Bleed,
  head: {
    p: Paragraph;
    x: number;
    width: number;
    align: 'left' | 'center';
    topPad: number;
    bottomPad: number;
  }
): number {
  const lines = type.wrap(head.p.text, head.p.face, head.p.size, head.width).length;
  const textTop = rect.y + rect.h - head.topPad;
  const textHeight = (lines - 1) * head.p.size * head.p.leading + head.p.size;
  const bottom = textTop - textHeight - head.bottomPad;
  const top = rect.y + rect.h + bleed.top;
  page.drawRectangle({
    x: rect.x - bleed.left,
    y: bottom,
    width: rect.w + bleed.left + bleed.right,
    height: top - bottom,
    color: fill(COLOR.fired),
  });
  paragraph(
    page,
    type,
    { ...head.p, color: COLOR.warmWhite },
    { x: head.x, width: head.width, top: textTop, align: head.align }
  );
  return bottom;
}

/** Sticker face, 100 x 100 mm trim. */
function stickerFace(
  page: PDFPage,
  type: Typesetter,
  input: FaceInput,
  rect: Rect,
  bleed: Bleed
): void {
  const pad = mm(SAFE_MM + 1);
  const innerW = rect.w - pad * 2;
  const x = rect.x + pad;
  const mid = rect.x + rect.w / 2;
  paintBackground(page, rect, bleed);

  const bandBottom = headlineBand(page, type, rect, bleed, {
    p: { text: STICKER_COPY.headline, face: 'latinBold', size: 15.5, leading: LEADING.latinBold },
    x,
    width: innerW,
    align: 'center',
    topPad: mm(SAFE_MM + 1),
    bottomPad: mm(3.5),
  });

  const cursor = paragraph(
    page,
    type,
    { text: STICKER_COPY.kannada, face: 'kannada', size: 11, leading: LEADING.kannada },
    { x, width: innerW, top: bandBottom - mm(2), align: 'center' }
  );

  const box = mm(61);
  const qrTop = cursor - mm(0.5);
  drawQr(page, input.code, input.baseUrl, { x: rect.x + (rect.w - box) / 2, top: qrTop, box });

  // Code above footer on the last rows, inside the safe area.
  const footerBaseline = rect.y + mm(SAFE_MM + 1.5);
  type.draw(page, codeLine(input.code), {
    face: 'latinBold',
    size: 11,
    x: mid,
    y: footerBaseline + 9 + mm(0.5),
    align: 'center',
    tracking: 0.5,
    color: COLOR.fired,
  });
  type.draw(page, STICKER_COPY.footer, {
    face: 'latin',
    size: 9,
    x: mid,
    y: footerBaseline,
    align: 'center',
    color: COLOR.fired,
  });
}

/** Table tent face: A5 landscape on a half of A4 (210 x 148.5 mm). QR left, words right. */
function tentFace(
  page: PDFPage,
  type: Typesetter,
  input: FaceInput,
  rect: Rect,
  bleed: Bleed
): void {
  const pad = mm(10);
  paintBackground(page, rect, bleed);

  // The face top is the fold, so there is no trim edge above the headline to keep clear of.
  const bandBottom = headlineBand(page, type, rect, bleed, {
    p: { text: PANEL_COPY.headline, face: 'latinBold', size: 27, leading: 1.2 },
    x: rect.x + pad,
    width: rect.w - pad * 2,
    align: 'left',
    topPad: mm(8),
    bottomPad: mm(6),
  });

  const box = mm(88);
  const qrX = rect.x + pad;
  const qrTop = bandBottom - mm(6);
  drawQr(page, input.code, input.baseUrl, { x: qrX, top: qrTop, box });
  type.draw(page, codeLine(input.code), {
    face: 'latinBold',
    size: 13,
    x: qrX + box / 2,
    y: qrTop - box - 14,
    align: 'center',
    tracking: 0.6,
    color: COLOR.fired,
  });
  type.draw(page, PANEL_COPY.footer, {
    face: 'latin',
    size: 10,
    x: qrX + box / 2,
    y: rect.y + mm(SAFE_MM + 2),
    align: 'center',
    color: COLOR.fired,
  });

  const colX = qrX + box + mm(8);
  const colW = rect.x + rect.w - pad - colX;
  let cursor = bandBottom - mm(6);
  cursor = paragraph(
    page,
    type,
    { text: PANEL_COPY.body, face: 'latin', size: 12.5, leading: LEADING.latin },
    { x: colX, width: colW, top: cursor, align: 'left' }
  );
  cursor = paragraph(
    page,
    type,
    { text: PANEL_COPY.kannada, face: 'kannada', size: 12, leading: LEADING.kannada },
    { x: colX, width: colW, top: cursor - mm(3), align: 'left' }
  );
  paragraph(
    page,
    type,
    { text: PANEL_COPY.reassurance, face: 'latinBold', size: 14, leading: LEADING.latinBold },
    { x: colX, width: colW, top: cursor - mm(3), align: 'left' }
  );
}

/** Poster face, A4 portrait, everything centred. */
function posterFace(
  page: PDFPage,
  type: Typesetter,
  input: FaceInput,
  rect: Rect,
  bleed: Bleed
): void {
  const pad = mm(16);
  const width = rect.w - pad * 2;
  const x = rect.x + pad;
  paintBackground(page, rect, bleed);

  const bandBottom = headlineBand(page, type, rect, bleed, {
    p: { text: PANEL_COPY.headline, face: 'latinBold', size: 40, leading: 1.2 },
    x,
    width,
    align: 'center',
    topPad: mm(14),
    bottomPad: mm(9),
  });

  let cursor = paragraph(
    page,
    type,
    { text: PANEL_COPY.body, face: 'latin', size: 16, leading: LEADING.latin },
    { x, width, top: bandBottom - mm(7), align: 'center' }
  );
  cursor = paragraph(
    page,
    type,
    { text: PANEL_COPY.kannada, face: 'kannada', size: 17, leading: LEADING.kannada },
    { x, width, top: cursor - mm(3), align: 'center' }
  );

  const box = mm(132);
  const qrTop = cursor - mm(4);
  const mid = rect.x + rect.w / 2;
  drawQr(page, input.code, input.baseUrl, { x: mid - box / 2, top: qrTop, box });
  type.draw(page, codeLine(input.code), {
    face: 'latinBold',
    size: 20,
    x: mid,
    y: qrTop - box - 20,
    align: 'center',
    tracking: 1,
    color: COLOR.fired,
  });
  paragraph(
    page,
    type,
    { text: PANEL_COPY.reassurance, face: 'latinBold', size: 20, leading: LEADING.latinBold },
    { x, width, top: qrTop - box - mm(13), align: 'center' }
  );
  type.draw(page, PANEL_COPY.footer, {
    face: 'latin',
    size: 14,
    x: mid,
    y: rect.y + mm(SAFE_MM + 4),
    align: 'center',
    color: COLOR.fired,
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

function line(page: PDFPage, x1: number, y1: number, x2: number, y2: number): void {
  page.drawLine({
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
    thickness: 0.4,
    color: rgb(0, 0, 0),
  });
}

/**
 * One mark in the slug, starting clear of the bleed and running outward from the trim point
 * (x, y). `dir` points away from the trim: -1 is left or down, 1 is right or up.
 */
function markAt(page: PDFPage, x: number, y: number, horizontal: boolean, dir: 1 | -1): void {
  const from = mm(BLEED_MM + MARK_GAP_MM) * dir;
  const to = mm(BLEED_MM + MARK_GAP_MM + MARK_LEN_MM) * dir;
  if (horizontal) line(page, x + from, y, x + to, y);
  else line(page, x, y + from, x, y + to);
}

/** Crop marks at the four corners of a trim box, outside the bleed. */
function cornerMarks(page: PDFPage, trim: Rect): void {
  for (const x of [trim.x, trim.x + trim.w]) {
    markAt(page, x, trim.y, false, -1);
    markAt(page, x, trim.y + trim.h, false, 1);
  }
  for (const y of [trim.y, trim.y + trim.h]) {
    markAt(page, trim.x, y, true, -1);
    markAt(page, trim.x + trim.w, y, true, 1);
  }
}

/** Sets the boxes a vendor reads: the trim, and the bleed 3 mm outside it. */
function setBoxes(page: PDFPage, trim: Rect): void {
  const b = mm(BLEED_MM);
  page.setTrimBox(trim.x, trim.y, trim.w, trim.h);
  page.setBleedBox(trim.x - b, trim.y - b, trim.w + b * 2, trim.h + b * 2);
}

const ALL_BLEED: Bleed = {
  left: mm(BLEED_MM),
  right: mm(BLEED_MM),
  top: mm(BLEED_MM),
  bottom: mm(BLEED_MM),
};

/** Sticker side and the gap between trims. Six millimetres lets two bleeds meet, not overlap. */
export const STICKER_MM = 100;
export const STICKER_GUTTER_MM = 6;
const SHEET_MM = STICKER_MM * 2 + STICKER_GUTTER_MM + SLUG_MM * 2;
/** The sticker sheet is square, 224 x 224 mm. Four bleeding stickers do not fit A4. */
export const STICKER_SHEET = { w: mm(SHEET_MM), h: mm(SHEET_MM) };
/** Tent and poster pages: A4 plus the slug on every side, 228 x 315 mm. */
export const FACE_PAGE = { w: mm(210 + SLUG_MM * 2), h: mm(297 + SLUG_MM * 2) };

/** Stickers per sheet: a 2 x 2 block, with crop marks on every trim line. */
export const STICKERS_PER_SHEET = 4;

/** Trim box of sticker `index` (0 top left, 1 top right, 2 bottom left, 3 bottom right). */
export function stickerRect(index: number): Rect {
  const col = index % 2;
  const row = Math.floor(index / 2);
  const step = mm(STICKER_MM + STICKER_GUTTER_MM);
  return {
    x: mm(SLUG_MM) + col * step,
    y: mm(SLUG_MM) + (1 - row) * step,
    w: mm(STICKER_MM),
    h: mm(STICKER_MM),
  };
}

function stickerSheet(doc: PDFDocument, type: Typesetter, codes: string[], baseUrl: string) {
  const page = doc.addPage([STICKER_SHEET.w, STICKER_SHEET.h]);
  codes.forEach((code, index) => {
    stickerFace(page, type, { code, baseUrl }, stickerRect(index), ALL_BLEED);
  });

  // A mark on every trim line, past the block: both edges of each gutter, so each cut is shown.
  const topLeft = stickerRect(0);
  const bottomRight = stickerRect(3);
  const left = topLeft.x;
  const bottom = bottomRight.y;
  const right = bottomRight.x + bottomRight.w;
  const top = topLeft.y + topLeft.h;
  const xs = [left, left + topLeft.w, bottomRight.x, right];
  const ys = [bottom, bottom + bottomRight.h, topLeft.y, top];
  for (const x of xs) {
    markAt(page, x, bottom, false, -1);
    markAt(page, x, top, false, 1);
  }
  for (const y of ys) {
    markAt(page, left, y, true, -1);
    markAt(page, right, y, true, 1);
  }
  setBoxes(page, { x: left, y: bottom, w: right - left, h: top - bottom });
}

/**
 * Table tent: one A4 trim folded across its width. The upper half is turned half a circle so
 * that, once folded and stood up, both faces read the right way up and carry the same face. The
 * top of each face is the fold, so the two bands meet there and the fold shows no white line.
 */
function tentSheet(doc: PDFDocument, type: Typesetter, code: string, baseUrl: string) {
  const page = doc.addPage([FACE_PAGE.w, FACE_PAGE.h]);
  const slug = mm(SLUG_MM);
  const half = mm(297) / 2;
  const lower: Rect = { x: slug, y: slug, w: mm(210), h: half };
  const upper: Rect = { x: slug, y: slug + half, w: mm(210), h: half };
  // Both faces run a hair past the fold, so the join cannot print as a gap.
  const bleed: Bleed = { ...ALL_BLEED, top: mm(0.3) };
  tentFace(page, type, { code, baseUrl }, lower, bleed);
  rotated180(page, upper, () => tentFace(page, type, { code, baseUrl }, upper, bleed));

  const trim: Rect = { x: slug, y: slug, w: mm(210), h: mm(297) };
  cornerMarks(page, trim);
  // Fold ticks, in the slug on both sides.
  markAt(page, trim.x, slug + half, true, -1);
  markAt(page, trim.x + trim.w, slug + half, true, 1);
  setBoxes(page, trim);
}

function posterSheet(doc: PDFDocument, type: Typesetter, code: string, baseUrl: string) {
  const page = doc.addPage([FACE_PAGE.w, FACE_PAGE.h]);
  const trim: Rect = { x: mm(SLUG_MM), y: mm(SLUG_MM), w: mm(210), h: mm(297) };
  posterFace(page, type, { code, baseUrl }, trim, ALL_BLEED);
  cornerMarks(page, trim);
  setBoxes(page, trim);
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
