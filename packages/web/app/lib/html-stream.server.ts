import { Transform } from 'node:stream';

/**
 * A pass-through stream for React's HTML that drops NUL bytes.
 *
 * React 18's Node renderer writes into 2,048-byte buffers. When the next character is
 * multi-byte (`·`, `→`, any Indian script) and does not fit in the bytes left, it sends the
 * whole buffer, so the unused end goes out as NUL. Abheri had one. The data is clean.
 *
 * A NUL byte is never part of a multi-byte UTF-8 character, so dropping it is safe, also when
 * a character is split between chunks.
 */
export function createHtmlStream(): Transform {
  return new Transform({
    transform(chunk: Buffer, _encoding, done) {
      done(null, chunk.includes(0) ? Buffer.from(chunk.filter(byte => byte !== 0)) : chunk);
    },
  });
}
