import zlib from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { chooseEncoding, compressResponse } from './compress.server';

const html = `<!DOCTYPE html><html><body>${'<p>Sunil Gargyan (vocal)</p>'.repeat(500)}</body></html>`;

function page(contentType = 'text/html') {
  return new Response(html, { status: 200, headers: { 'Content-Type': contentType } });
}

function get(acceptEncoding?: string, method = 'GET') {
  return new Request('https://rasika.life/events', {
    method,
    headers: acceptEncoding ? { 'Accept-Encoding': acceptEncoding } : {},
  });
}

describe('chooseEncoding', () => {
  it('prefers brotli, then gzip, and honours q=0', () => {
    expect(chooseEncoding('gzip, deflate, br')).toBe('br');
    expect(chooseEncoding('gzip')).toBe('gzip');
    expect(chooseEncoding('br;q=0, gzip')).toBe('gzip');
    expect(chooseEncoding('identity')).toBeNull();
    expect(chooseEncoding(null)).toBeNull();
  });
});

describe('compressResponse', () => {
  it('brotli-compresses a page and the bytes decode back', async () => {
    const res = compressResponse(get('br, gzip'), page());
    expect(res.headers.get('Content-Encoding')).toBe('br');
    expect(res.headers.get('Vary')).toContain('Accept-Encoding');
    const body = Buffer.from(await res.arrayBuffer());
    expect(body.length).toBeLessThan(html.length / 10);
    expect(zlib.brotliDecompressSync(body).toString()).toBe(html);
  });

  it('gzips for a client without brotli', async () => {
    const res = compressResponse(get('gzip'), page());
    expect(res.headers.get('Content-Encoding')).toBe('gzip');
    expect(zlib.gunzipSync(Buffer.from(await res.arrayBuffer())).toString()).toBe(html);
  });

  it('leaves alone what it must not touch, but still varies', async () => {
    for (const res of [
      compressResponse(get(), page()),
      compressResponse(get('br'), page('image/png')),
      compressResponse(get('br', 'HEAD'), page()),
    ]) {
      expect(res.headers.get('Content-Encoding')).toBeNull();
      expect(res.headers.get('Vary')).toContain('Accept-Encoding');
    }
  });

  it('compresses a client navigation payload too', () => {
    const res = compressResponse(get('br'), page('text/x-script'));
    expect(res.headers.get('Content-Encoding')).toBe('br');
    expect(
      compressResponse(get('br'), page('application/vnd.turbo-stream')).headers.get(
        'Content-Encoding'
      )
    ).toBe('br');
  });
});
