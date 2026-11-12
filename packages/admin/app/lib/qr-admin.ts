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

/** One row of the bulk assign form: a code, its label and whether it is ticked. */
export type AssignRow = { code: string; label: string; ticked: boolean };

/**
 * Fills the empty labels of ticked rows with `${text} 1`, `${text} 2`, numbered by position among
 * the ticked rows. A label already typed stays, and so does an unticked row.
 */
export function fillLabels(rows: AssignRow[], text: string): AssignRow[] {
  const base = text.trim();
  if (!base) return rows;
  let position = 0;
  return rows.map(row => {
    if (!row.ticked) return row;
    position += 1;
    return row.label.trim() ? row : { ...row, label: `${base} ${position}` };
  });
}

/** Reads the bulk assign form: ticked codes and the label typed for each, in page order. */
export function readAssignRows(
  form: { getAll(name: string): unknown[]; get(name: string): unknown },
  pageOrder: string[]
): AssignRow[] {
  const ticked = new Set(form.getAll('codes').map(String));
  return pageOrder.map(code => ({
    code,
    label: String(form.get(`label-${code}`) ?? ''),
    ticked: ticked.has(code),
  }));
}

/** The ticked rows (at most `max`, in page order) split into ready items and codes with no label. */
export function assignItems(
  rows: AssignRow[],
  max: number
): { items: { code: string; label: string }[]; missing: string[]; ticked: number } {
  const ticked = rows.filter(row => row.ticked).slice(0, max);
  return {
    items: ticked
      .filter(row => row.label.trim())
      .map(row => ({ code: row.code, label: row.label.trim() })),
    missing: ticked.filter(row => !row.label.trim()).map(row => row.code),
    ticked: ticked.length,
  };
}
