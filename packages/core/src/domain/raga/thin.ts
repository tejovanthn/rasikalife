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
 *
 * `KEEP_INDEXED_RAGA_IDS` overrides it: pages the rule would catch that still
 * earned impressions. The owner chose to keep those indexed.
 */
export function isThinRaga(raga: {
  id?: string;
  arohanam?: string | null;
  avarohanam?: string | null;
  alternateScales?: string[] | null;
  description?: string | null;
  performanceCount?: number | null;
  /** Compositions linked to this raga. */
  compositionCount: number;
}): boolean {
  if (raga.id && KEEP_INDEXED_RAGA_IDS.has(raga.id)) return false;
  const hasScale =
    !!raga.arohanam?.trim() ||
    !!raga.avarohanam?.trim() ||
    (raga.alternateScales ?? []).some(s => s.trim().length > 0);
  const hasDescription = !!raga.description?.trim();
  const hasPerformances = (raga.performanceCount ?? 0) > 0;
  return !hasScale && !hasDescription && !hasPerformances && raga.compositionCount === 0;
}

/**
 * Thin raga pages that stay indexed anyway.
 *
 * These 20 pages match the thin rule but each earned at least one Search
 * Console impression in the 90 days to 2026-10-09 (48 impressions and 1 click
 * between them). The owner decided a page that is being shown in results stays
 * indexed. The other 23 thin pages had no impressions and get `noindex`.
 *
 * Do not grow this list by hand-picking. Re-pull Search Console instead, and
 * drop an entry once its page has a scale, description or composition: the
 * rule already keeps it then.
 */
export const KEEP_INDEXED_RAGA_IDS: ReadonlySet<string> = new Set([
  '3A73KrTU0EgXIV0W20AGmQSDsZw', // rajalahari: 5 impressions
  '3A73Q6s4E3UuFf7SFYT90faK5j9', // sudda nattai: 5
  '3A73AtXQhR4PN0EN7AKc9DntpmI', // harikalyani: 4
  '3A73O2CR0hauVsy6v15HmegdlIt', // shri cintamani: 4
  '3A73PbT2kIsHCBdZ0e6NeWEBdBI', // sudda cintamani: 4
  '3A73BPyFAAyHxoPqdKhR4TQcpwD', // hindustani gandhari: 3
  '3A73M1CUzFobvNeu6Hf1EFTMUoT', // rudrabharana: 3
  '3A73MdIOCs7itsAbIfHRarZld51', // sanga: 3
  '3A73JIK4kEIfmn7UGVpqQrMuBrk', // parvatavardhini: 2
  '3A73Kw3omy852TrOUgAaXlgYyA7', // rajahamsini: 2
  '3A73NobjGmNHawpdP1xCbvPsFrc', // shiva kalyanam: 2 (1 click)
  '3A73OCVKfq5KyL6HiPE13utsBLG', // shrikantimati: 2
  '3A73OTMphBY05PZ8kWHqL066YkU', // shubhakalyani: 2
  '3A736uNE8ryQ9cLCE34oNmv6iHV', // deshikakhamas: 1
  '3A73BmNtw5GH01KLjYAbNkH8xII', // jalini: 1
  '3A73GwmRMhRrahxNb4WlenH7vwB', // mukundabhairavam: 1
  '3A73IAbymX4kq6lUqw1MF59w81H', // navakanti: 1
  '3A73JPggnEsWcNCVVE3W3bMcxLz', // pancagata: 1
  '3A73MXBVXJjPv1e8DLxCzKDZFRQ', // sampurnam: 1
  '3A73SYXTP0PNnHzWcZPX9gfj052', // vasavanti: 1
]);
