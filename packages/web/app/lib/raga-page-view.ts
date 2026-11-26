import { fromItrans } from '@rasika/core/utils/transliteration';
import { titleCaseName } from '~/lib/utils';

type Script = Parameters<typeof fromItrans>[1];

type RelativeLike = { id: string; changes: unknown[] };

/**
 * The "Close relatives" list for a raga page.
 *
 * Leaves out the raga's own parent (the Parent Raga row already links it) and collapses
 * records that differ from this raga by exactly the same notes. Those are one scale stored
 * twice ("Ahirbhairav" and "Ahiri Bhairavi (Ahir Bhairav)"), until the raga dedupe in STATE.md
 * is applied. A relative with no note change (same notes, different movement) is never
 * collapsed, as those are different ragas.
 */
export function relativesView<T extends RelativeLike>(
  relatives: T[],
  parentId: string | undefined
): T[] {
  const seen = new Set<string>();
  return relatives.filter(r => {
    if (parentId && r.id === parentId) return false;
    if (r.changes.length === 0) return true;
    const key = JSON.stringify(r.changes);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * The parent melakarta's name for the "Janya ragas of ..." heading. The parent record is the
 * name the page already shows in the Parent Raga row, so the heading uses it. The fixed name
 * table is the fallback for a raga with a mela number but no parent record.
 */
export function janyaParentName(
  parent: { name: string } | null | undefined,
  melaNumber: number,
  melaNames: Record<number, string>
): string | undefined {
  return parent?.name ?? melaNames[melaNumber];
}

/**
 * "Performed at concerts" rows. Stored titles are ITRANS ("ArUrAn2 pADiya"), so `display` is
 * for reading and `title` stays raw for the link slug. Run once, in the loader: it is not
 * idempotent.
 */
export function topCompositionsView<T extends { title: string }>(
  top: T[],
  script: Script
): (T & { display: string })[] {
  return top.map(c => ({ ...c, display: titleCaseName(fromItrans(c.title, script)) }));
}
