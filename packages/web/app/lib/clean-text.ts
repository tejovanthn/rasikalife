// Control characters (NUL and the rest of C0, minus tab, newline and carriage return) in a
// stored string end up in the page HTML, where they are invalid. One record (the Abheri
// raga) holds a NUL. Stored data is left alone; the web server removes them from what the
// API returns, before any page renders.

/** Remove C0 control characters except tab, newline and carriage return. */
export function stripControlChars(text: string): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: this is the point
  return text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}

/**
 * The same for a JSON document as text, where a control character is written as an escape
 * such as `\u0000`. An escaped backslash followed by "u0000" is real text and is kept: the
 * escape only counts when it is preceded by an even number of backslashes.
 */
export function stripControlCharsFromJson(json: string): string {
  // Scan left to right: `\\` is consumed as a pair, so a `\u0000` after it is not an escape.
  return json.replace(/\\\\|\\u00(?:0[0-8bBcCeEfF]|1[0-9a-fA-F])/g, match =>
    match === '\\\\' ? match : ''
  );
}

/** A fetch that cleans JSON responses with `stripControlCharsFromJson`. */
export function cleaningFetch(
  inner: typeof fetch = (...args) => fetch(...args)
): (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> {
  return async (input, init) => {
    const res = await inner(input, init);
    const type = res.headers.get('content-type') ?? '';
    if (!type.includes('json')) return res;
    const text = await res.text();
    const clean = stripControlCharsFromJson(text);
    const headers = new Headers(res.headers);
    // The body is already decoded and its length may have changed.
    headers.delete('content-length');
    headers.delete('content-encoding');
    return new Response(clean, { status: res.status, statusText: res.statusText, headers });
  };
}
