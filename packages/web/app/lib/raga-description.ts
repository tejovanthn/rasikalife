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
  }

  return sentences.join(' ');
}
