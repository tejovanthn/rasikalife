import { QR_CODE_ALPHABET, QR_CODE_LENGTH } from '@rasika/core/domain/venue-qr/client';

/**
 * Reads a code a person typed from the printed line under the QR. Case and spacing do not
 * matter, and the Crockford look-alikes fold the way the alphabet does: I and L are 1, O is 0.
 * U is not in the alphabet at all, so it stays and the result is rejected.
 */
export function parseCodeInput(raw: string | null | undefined): string | null {
  const cleaned = (raw ?? '')
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/[IL]/g, '1')
    .replace(/O/g, '0');
  if (cleaned.length !== QR_CODE_LENGTH) return null;
  for (const char of cleaned) {
    if (!QR_CODE_ALPHABET.includes(char)) return null;
  }
  return cleaned;
}

function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

export type VenueOption = { id: string; name: string; city?: string | null };

/** Case and diacritic blind match on name or city, best matches (prefix) first. */
export function filterVenues<T extends VenueOption>(venues: T[], query: string, limit = 50): T[] {
  const q = fold(query.trim());
  if (!q) return venues.slice(0, limit);
  const scored: Array<{ venue: T; rank: number }> = [];
  for (const venue of venues) {
    const name = fold(venue.name);
    const city = fold(venue.city ?? '');
    if (name.startsWith(q)) scored.push({ venue, rank: 0 });
    else if (name.includes(q)) scored.push({ venue, rank: 1 });
    else if (city.includes(q)) scored.push({ venue, rank: 2 });
  }
  return scored
    .sort((a, b) => a.rank - b.rank || a.venue.name.localeCompare(b.venue.name))
    .slice(0, limit)
    .map(entry => entry.venue);
}

/** `qr.list` input from the URL. A value that is not a known filter is ignored, not trusted. */
export function parseListFilters(params: URLSearchParams): {
  status?: 'unassigned' | 'active' | 'retired';
  batchId?: string;
  venueId?: string;
  cursor?: string;
} {
  const status = params.get('status');
  return {
    status:
      status === 'unassigned' || status === 'active' || status === 'retired' ? status : undefined,
    batchId: params.get('batchId') || undefined,
    venueId: params.get('venueId') || undefined,
    cursor: params.get('cursor') || undefined,
  };
}

/** The live scan page of the public site, for "Test scan". */
export function testScanUrl(siteUrl: string, code: string): string {
  return `${siteUrl.replace(/\/$/, '')}/q/${code}`;
}

/** Where a moderator who scanned an unassigned code lands (built by the scan page). */
export function assignPath(code: string): string {
  return `/qr/${code}/assign`;
}

/** The batch page polls only while the PDF is being prepared. */
export function shouldPollBatch(pdfStatus: string | undefined): boolean {
  return pdfStatus === 'pending';
}

const WHEN = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

/** "12 Nov, 6:00 pm" in IST, whatever the server's zone. */
export function formatWhen(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return WHEN.format(date)
    .replace(/\bam\b/i, 'am')
    .replace(/\bpm\b/i, 'pm');
}

/** Labels for a bulk assign: `${prefix} 1`, `${prefix} 2`, in the order given (core does this). */
export function numberedLabels(prefix: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => `${prefix.trim()} ${index + 1}`);
}

/** Picks the checked codes from a form, in page order, at most `max`. */
export function selectedCodes(formValues: string[], pageOrder: string[], max: number): string[] {
  const chosen = new Set(formValues);
  return pageOrder.filter(code => chosen.has(code)).slice(0, max);
}
