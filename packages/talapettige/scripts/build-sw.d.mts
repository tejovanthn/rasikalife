export interface PrecacheEntry {
  file: string;
  url: string;
}
export function precacheEntries(files: string[]): PrecacheEntry[];
export function precacheVersion(
  entries: PrecacheEntry[],
  read: (file: string) => string | Uint8Array
): string;
