/**
 * Returns the URL only when it is an absolute http or https URL, else undefined. Stored values
 * can predate the write-time check, so pages run every owner-supplied link through this before
 * rendering it as an href or src (a `javascript:` href runs script on click).
 */
export function safeHttpUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:' ? value : undefined;
  } catch {
    return undefined;
  }
}
