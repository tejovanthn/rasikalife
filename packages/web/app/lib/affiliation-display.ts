/**
 * How an affiliation's dates read on a page.
 *
 * `isCurrent` is stored apart from `endYear` rather than derived from it, because "faculty at
 * IIM Bangalore, started at some point nobody recorded" is the ordinary shape of this data — a
 * blank `endYear` on its own cannot say whether a role is current or merely undated. So a row
 * with only `startYear` reads "since 2017" when nothing claims it is current, and
 * "2017–present" when something does.
 *
 * Returns '' when the row says nothing about time at all, so a caller can drop the separator
 * rather than render an empty pair of brackets.
 */
export function affiliationPeriod(affiliation: {
  startYear?: number;
  endYear?: number;
  isCurrent?: boolean;
}): string {
  const { startYear, endYear, isCurrent } = affiliation;
  if (startYear && endYear) return `${startYear}–${endYear}`;
  if (startYear) return isCurrent ? `${startYear}–present` : `since ${startYear}`;
  if (endYear) return `until ${endYear}`;
  return isCurrent ? 'current' : '';
}
