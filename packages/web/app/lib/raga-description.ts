/**
 * The meta description for a raga page, built from the fields the record
 * actually holds.
 *
 * It already named the arohanam/avarohanam and the melakarta relationship —
 * the fix for "renowned"-style inflation applied here first. But the page
 * also has a "Performed at concerts" section (a real, logged performance
 * count plus the compositions people actually search alongside a raga), and
 * that never made it into the description. For a raga like Mukhari or
 * Natabhairavi — heavily performed, heavily searched, and already competing
 * with Wikipedia for the same query — the arohanam alone can't distinguish
 * this page from a general reference site. A logged performance count and
 * real composition titles can. Same principle as `listing-description.ts`:
 * name what is on the page, not what kind of page it is.
 */
export function ragaMetaDescription(raga: {
  name: string;
  arohanam?: string | null;
  avarohanam?: string | null;
  melaNumber?: number | null;
  parentRaga?: { name: string } | null;
  performanceCount?: number;
  topCompositions?: Array<{ title: string }>;
  /** Compositions listed on the page, used when no performance is logged. */
  compositions?: Array<{ title: string }>;
}): string {
  const isJanya = !!raga.parentRaga;
  const sentences = [`${raga.name} raga in Carnatic music.`];

  if (raga.arohanam) sentences.push(`Arohanam: ${raga.arohanam}.`);
  if (raga.avarohanam) sentences.push(`Avarohanam: ${raga.avarohanam}.`);

  // A janya raga carries its parent's mela number. Reporting that bare said
  // "Melakarta 20" on a page whose own title read "Janya Raga" — two claims
  // in one result, and the wrong one is the claim an arohanam search is
  // there to check.
  if (isJanya) {
    const parentName = raga.parentRaga?.name ?? '';
    const mela = raga.melaNumber ? ` (melakarta ${raga.melaNumber})` : '';
    sentences.push(`Janya raga derived from ${parentName}${mela}.`);
  } else if (raga.melaNumber) {
    sentences.push(`Melakarta ${raga.melaNumber}.`);
  }

  const performanceCount = raga.performanceCount ?? 0;
  const topCompositions = raga.topCompositions ?? [];
  if (performanceCount > 0 && topCompositions.length > 0) {
    const compNames = topCompositions
      .slice(0, 2)
      .map(c => c.title)
      .join(' and ');
    sentences.push(
      `Performed ${performanceCount} time${performanceCount === 1 ? '' : 's'} in concert, including ${compNames}.`
    );
  } else if ((raga.compositions ?? []).length > 0) {
    // Most ragas have no logged performance, but many list compositions.
    // Naming two makes the snippet differ from every other raga's.
    const compNames = (raga.compositions ?? [])
      .slice(0, 2)
      .map(c => c.title)
      .join(' and ');
    sentences.push(`Compositions include ${compNames}.`);
  }

  // Google cuts near 155 characters. Drop whole trailing sentences rather
  // than cut one in half; the name and scale always come first.
  let description = sentences[0];
  for (const sentence of sentences.slice(1)) {
    if (`${description} ${sentence}`.length > DESCRIPTION_MAX) break;
    description = `${description} ${sentence}`;
  }
  return description;
}

const DESCRIPTION_MAX = 155;
const TITLE_MAX = 60;
const BRAND = ' | Rasika.life';

/**
 * The `<title>` for a raga page.
 *
 * Search Console shows these pages are found by "<name> raga" and
 * "<name> ragam" (bindumalini raga: 401 impressions at position 2.9), so the
 * title leads with exactly that. It then names only what the page shows:
 * the scale when it is stored, compositions when any are listed. The old
 * title promised "Arohana, Avarohana" on records holding neither, and at
 * 70+ characters Google cut it before the brand.
 *
 * Candidates run from most to least detailed; the first that fits in 60
 * characters wins. A long name falls back to "<name> Raga" alone.
 */
export function ragaMetaTitle(raga: {
  name: string;
  arohanam?: string | null;
  avarohanam?: string | null;
  melaNumber?: number | null;
  parentRaga?: { name: string } | null;
  hasCompositions?: boolean;
}): string {
  const head = `${raga.name} Raga`;
  // Only a melakarta owns its mela number; a janya stores its parent's.
  const mela = !raga.parentRaga && raga.melaNumber ? ` (Melakarta ${raga.melaNumber})` : '';

  const facts: string[] = [];
  if (raga.arohanam || raga.avarohanam) facts.push('Arohanam, Avarohanam');
  if (raga.hasCompositions) facts.push('Compositions');

  // What the searcher came for outranks the brand: Google shows the site
  // name beside the result anyway, so the brand is dropped first.
  const candidates: string[] = [];
  for (let n = facts.length; n >= 0; n--) {
    const tail = n > 0 ? `: ${facts.slice(0, n).join(', ')}` : '';
    if (mela) candidates.push(`${head}${mela}${tail}${BRAND}`, `${head}${mela}${tail}`);
    candidates.push(`${head}${tail}${BRAND}`, `${head}${tail}`);
  }

  return candidates.find(c => c.length <= TITLE_MAX) ?? head;
}
