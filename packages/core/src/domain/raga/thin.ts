/**
 * Whether a raga page is too thin to offer to search engines.
 *
 * A thin page holds nothing but a name: no scale, no description, no
 * composition and no logged performance. Such a page gets `noindex, follow`
 * and is left out of the sitemap. It comes back on its own the moment any of
 * these is added, because the rule reads the record, not a list.
 *
 * The rule was picked against Search Console (90 days to 2026-10-09). Of 1,526
 * raga pages, 60 had no scale and no composition. 17 of those carry a
 * description, and those 17 are the ones that rank: Mishra Yaman alone took
 * 400 impressions and 15 clicks on its description. So a description keeps a
 * page indexed. The 43 pages left took 48 impressions and 1 click between them.
 *
 * A parent raga or mela number alone does not count: it is one line that the
 * parent's own page already shows.
 *
 * Pure, so the raga page (at request time) and the search indexer (for the
 * sitemap) apply the same rule.
 */
export function isThinRaga(raga: {
  arohanam?: string | null;
  avarohanam?: string | null;
  alternateScales?: string[] | null;
  description?: string | null;
  performanceCount?: number | null;
  /** Compositions linked to this raga. */
  compositionCount: number;
}): boolean {
  const hasScale =
    !!raga.arohanam?.trim() ||
    !!raga.avarohanam?.trim() ||
    (raga.alternateScales ?? []).some(s => s.trim().length > 0);
  const hasDescription = !!raga.description?.trim();
  const hasPerformances = (raga.performanceCount ?? 0) > 0;
  return !hasScale && !hasDescription && !hasPerformances && raga.compositionCount === 0;
}
