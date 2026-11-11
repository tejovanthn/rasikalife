import QRCode from 'qrcode';

/** The URL a printed code carries. Same base as core's `QR_BASE_URL`. */
export function qrUrl(code: string, baseUrl: string): string {
  return `${baseUrl}${code}`;
}

export type QrMatrix = { size: number; dark: (row: number, col: number) => boolean };

/** Error correction level M, as the spec says. The quiet zone is added by the caller. */
export function qrMatrix(text: string): QrMatrix {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const { size, data } = qr.modules;
  return { size, dark: (row, col) => data[row * size + col] === 1 };
}

/**
 * One SVG path for all dark modules, in module units with y pointing down and the origin at the
 * top left of the symbol. Horizontal runs are merged, which keeps the PDF small and avoids
 * hairline seams between neighbouring squares.
 */
export function qrPath(matrix: QrMatrix): string {
  const parts: string[] = [];
  for (let row = 0; row < matrix.size; row += 1) {
    let col = 0;
    while (col < matrix.size) {
      if (!matrix.dark(row, col)) {
        col += 1;
        continue;
      }
      const start = col;
      while (col < matrix.size && matrix.dark(row, col)) col += 1;
      parts.push(`M${start},${row}h${col - start}v1h${start - col}z`);
    }
  }
  return parts.join('');
}
