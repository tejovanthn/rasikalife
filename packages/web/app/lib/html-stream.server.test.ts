import { PassThrough } from 'node:stream';
import { createElement } from 'react';
import { renderToPipeableStream } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createHtmlStream } from './html-stream.server';

function render(pad: number, through: () => NodeJS.ReadWriteStream): Promise<Buffer> {
  const page = createElement(
    'div',
    null,
    'a'.repeat(pad),
    ...Array.from({ length: 150 }, (_, i) => createElement('span', { key: i }, ` · ಕಾಪಿ ${i}`))
  );
  return new Promise((resolve, reject) => {
    const out = through();
    const chunks: Buffer[] = [];
    out.on('data', (chunk: Buffer) => chunks.push(chunk));
    out.on('end', () => resolve(Buffer.concat(chunks)));
    out.on('error', reject);
    const { pipe } = renderToPipeableStream(page, {
      onAllReady() {
        pipe(out);
      },
    });
  });
}

describe('createHtmlStream', () => {
  // If this fails after a React upgrade, React has fixed the bug and the stream can go.
  it('React still leaves NUL bytes at a buffer end', async () => {
    let found = 0;
    for (let pad = 0; pad < 200; pad++) {
      if ((await render(pad, () => new PassThrough())).includes(0)) found++;
    }
    expect(found).toBeGreaterThan(0);
  });

  it('removes them and changes nothing else', async () => {
    for (let pad = 0; pad < 200; pad++) {
      const raw = await render(pad, () => new PassThrough());
      const clean = await render(pad, createHtmlStream);
      expect(clean.includes(0)).toBe(false);
      expect(clean.toString('utf8')).toBe(raw.toString('utf8').replaceAll('\0', ''));
    }
  });

  it('keeps a character that is split between chunks', async () => {
    const out = createHtmlStream();
    const chunks: Buffer[] = [];
    out.on('data', (chunk: Buffer) => chunks.push(chunk));
    const bytes = Buffer.from('→');
    out.write(Buffer.concat([bytes.subarray(0, 1), Buffer.from([0])]));
    out.end(bytes.subarray(1));
    await new Promise(resolve => out.on('end', resolve));
    expect(Buffer.concat(chunks).toString('utf8')).toBe('→');
  });
});
