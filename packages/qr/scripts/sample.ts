// Renders a sample PDF locally and prints the time taken.
//   pnpm --filter @rasika/qr sample <format> <count> <out.pdf>
import { writeFileSync } from 'node:fs';
import type { QrFormat } from '@rasika/core/domain/qr-batch/client';
import { QR_BASE_URL, QR_CODE_ALPHABET } from '@rasika/core/domain/venue-qr/client';
import { renderBatchPdf } from '../src/layout';
import { Typesetter } from '../src/typesetter';

const format = (process.argv[2] ?? 'sticker') as QrFormat;
const count = Number(process.argv[3] ?? 200);
const out = process.argv[4] ?? `sample-${format}.pdf`;

function fakeCode(seed: number): string {
  let n = seed * 2654435761;
  let code = '';
  for (let i = 0; i < 8; i += 1) {
    code += QR_CODE_ALPHABET[Math.abs(n) % 32];
    n = Math.floor(n / 32) + seed * 7919;
  }
  return code;
}

const started = Date.now();
const typesetter = await Typesetter.create();
const codes = Array.from({ length: count }, (_, i) => fakeCode(i + 1));
const bytes = await renderBatchPdf({ format, codes, baseUrl: QR_BASE_URL, typesetter });
writeFileSync(out, bytes);
console.log(
  `${format} x ${count}: ${Date.now() - started} ms, ${(bytes.length / 1024).toFixed(0)} KiB`
);
