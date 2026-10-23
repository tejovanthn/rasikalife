import { Readable } from 'node:stream';
import type { ReadableStream as NodeWebReadableStream } from 'node:stream/web';
import zlib from 'node:zlib';

/**
 * Compresses a server-rendered response in the Lambda, because nothing downstream will.
 *
 * CloudFront compresses only a response that carries a Content-Length, and SST's React handler
 * (`.sst/platform/functions/react-server/server.mjs`) streams every response with
 * `Transfer-Encoding: chunked`. So every page went out raw: /events was 118 kB, a raga index
 * 157 kB, on a site read on phones in concert halls. The cache policy already keys on the
 * normalised Accept-Encoding (`enableAcceptEncodingBrotli/Gzip`), so the br, gzip and identity
 * copies are cached apart.
 *
 * Each chunk is flushed as it is written, so a streamed page still arrives progressively.
 * Brotli quality 5: most of the saving of 11 for a fraction of the CPU, on every cache miss.
 */

const COMPRESSIBLE = /^(text\/|application\/(json|javascript|xml)|.*turbo-stream)/i;

export type Encoding = 'br' | 'gzip';

/** The best encoding the client accepts, or null. A `q=0` refuses it. */
export function chooseEncoding(acceptEncoding: string | null): Encoding | null {
  if (!acceptEncoding) return null;
  const accepted = new Map<string, number>();
  for (const part of acceptEncoding.split(',')) {
    const [name, ...params] = part.trim().toLowerCase().split(';');
    const q = params.find(p => p.trim().startsWith('q='));
    accepted.set(name.trim(), q ? Number(q.trim().slice(2)) : 1);
  }
  const ok = (name: string) => (accepted.get(name) ?? accepted.get('*') ?? 0) > 0;
  if (ok('br')) return 'br';
  if (ok('gzip')) return 'gzip';
  return null;
}

function compressor(encoding: Encoding) {
  return encoding === 'br'
    ? zlib.createBrotliCompress({
        flush: zlib.constants.BROTLI_OPERATION_FLUSH,
        params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 },
      })
    : zlib.createGzip({ flush: zlib.constants.Z_SYNC_FLUSH });
}

export function compressResponse(request: Request, response: Response): Response {
  const headers = new Headers(response.headers);
  // Whatever happens, a cache in front must keep the encodings apart.
  headers.append('Vary', 'Accept-Encoding');

  const type = headers.get('Content-Type') ?? '';
  if (
    !response.body ||
    request.method === 'HEAD' ||
    headers.has('Content-Encoding') ||
    !COMPRESSIBLE.test(type) ||
    response.status === 204 ||
    response.status === 304
  ) {
    return new Response(response.body, { status: response.status, headers });
  }

  const encoding = chooseEncoding(request.headers.get('Accept-Encoding'));
  if (!encoding) return new Response(response.body, { status: response.status, headers });

  const compressed = Readable.fromWeb(response.body as unknown as NodeWebReadableStream).pipe(
    compressor(encoding)
  );
  headers.set('Content-Encoding', encoding);
  headers.delete('Content-Length');
  return new Response(Readable.toWeb(compressed) as unknown as ReadableStream, {
    status: response.status,
    headers,
  });
}
