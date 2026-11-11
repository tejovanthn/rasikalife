/**
 * Pure helpers for the VenueQr key design. No imports, so `client.ts` can re-export them.
 */

/**
 * The value the `byVenue` index is keyed on.
 *
 * `venueId` is optional (an unassigned code has none), and an ElectroDB index over an optional
 * attribute is not sparse: the missing composite writes `venue_qrs#` with an empty suffix, so
 * every unassigned code lands in one partition that a blank `venueId` argument then matches
 * (CLAUDE.md rule 9). So the index is keyed on this required value instead: the venue id once a
 * code is assigned, and `batch#<batchId>` before. An unassigned code then sits in a partition
 * of its own batch (at most 200 rows), and no venue id can ever address it.
 */
export function venueRefFor(input: { venueId?: string | null; batchId: string }): string {
  return input.venueId ? input.venueId : `batch#${input.batchId}`;
}

export function qrUrl(code: string, baseUrl = 'https://rasika.life/q/'): string {
  return `${baseUrl}${code}`;
}
