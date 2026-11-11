/**
 * Builders for the list pages that carry the head terms in the 2026-11 keyword research
 * (docs/seo/keyword-research-2026-11.md): the melakarta list, the janya list, the varnam list
 * and the composer compositions page. Pure, so the rules are tested here and the routes only
 * fetch and render.
 *
 * Same rule as the other meta builders: a title or description claims only what the page shows.
 */

import { CHAKRA_NAMES, chakraOfMela, melakartaScale } from '@rasika/core/domain/raga/melakarta';

const DESCRIPTION_MAX = 155;

function clamp(text: string, max = DESCRIPTION_MAX): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max / 2 ? cut.slice(0, space) : cut).replace(/[ ,;:.-]+$/, '')}…`;
}

export interface MelakartaRow {
  mela: number;
  /** ITRANS name as stored; the route converts it to the viewer's script. */
  name: string;
  id: string;
  chakra: number;
  chakraName: string;
  /** Arohanam in ITRANS. The scale is fixed by the number, so it is never in doubt. */
  scale: string;
}

/**
 * One row per melakarta, 1 to 72, from the generated record links. A number with no linked
 * record is left out rather than shown without a page to go to.
 */
export function melakartaRows(links: Record<number, { id: string; name: string }>): MelakartaRow[] {
  const rows: MelakartaRow[] = [];
  for (let mela = 1; mela <= 72; mela++) {
    const link = links[mela];
    if (!link) continue;
    const chakra = chakraOfMela(mela);
    rows.push({
      mela,
      name: link.name,
      id: link.id,
      chakra,
      chakraName: CHAKRA_NAMES[chakra - 1],
      scale: melakartaScale(mela),
    });
  }
  return rows;
}

export interface JanyaGroup {
  mela: number;
  parentId: string;
  parentName: string;
  janyas: Array<{ id: string; name: string }>;
}

/**
 * Janya ragas grouped under their parent melakarta, in mela order, each group sorted by name.
 * A raga whose parent is not one of the 72 (a janya of a janya, or a stale parent) is dropped:
 * the page promises "by parent melakarta". A parent is never listed under itself.
 */
export function groupJanyaByParent(
  janyas: Array<{ id: string; name: string; parentRaga: { id: string; name: string } }>,
  links: Record<number, { id: string; name: string }>
): JanyaGroup[] {
  const melaOfId = new Map<string, number>();
  for (const [mela, link] of Object.entries(links)) melaOfId.set(link.id, Number(mela));

  const groups = new Map<number, JanyaGroup>();
  for (const j of janyas) {
    const mela = melaOfId.get(j.parentRaga.id);
    if (mela === undefined || j.id === j.parentRaga.id) continue;
    let group = groups.get(mela);
    if (!group) {
      group = {
        mela,
        parentId: j.parentRaga.id,
        parentName: links[mela].name,
        janyas: [],
      };
      groups.set(mela, group);
    }
    group.janyas.push({ id: j.id, name: j.name });
  }
  return [...groups.values()]
    .map(g => ({
      ...g,
      janyas: g.janyas.sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.mela - b.mela);
}

export function melakartaListMeta(): { title: string; description: string } {
  return {
    title: 'The 72 Melakarta Ragas: Full List with Numbers | Rasika.life',
    description:
      'The 72 melakarta ragas of Carnatic music in order: number, name, chakra and arohanam, each linked to its raga page.',
  };
}

export function janyaListMeta(counts: { ragas: number; parents: number }): {
  title: string;
  description: string;
} {
  const has = counts.ragas > 0;
  return {
    title: 'Janya Ragas in Carnatic Music, by Melakarta | Rasika.life',
    description: clamp(
      has
        ? `${counts.ragas} janya ragas grouped by their parent melakarta, across ${counts.parents} melakartas. Each links to its raga page.`
        : 'Janya ragas of Carnatic music, grouped by their parent melakarta.'
    ),
  };
}

export function varnamListMeta(count: number): { title: string; description: string } {
  return {
    title: 'Varnam Lyrics: Carnatic Varnams List | Rasika.life',
    description: clamp(
      count > 0
        ? `${count} Carnatic varnams with lyrics, composer, raga and tala. Open a varnam to read its lyrics in Roman, Devanagari, Tamil, Telugu or Kannada.`
        : 'Carnatic varnams with lyrics, composer, raga and tala.'
    ),
  };
}

/**
 * Meta for `/artists/<slug>/compositions`. Search sees "purandara dasa songs lyrics"; the
 * title leads with the name and says what the page is. The count is claimed only when the
 * page lists compositions, and gets a "+" when more pages follow.
 */
export function composerCompositionsMeta(
  composer: { name: string },
  count: number,
  hasMore = false
): {
  title: string;
  description: string;
} {
  const name = composer.name;
  return {
    title: `${name} Compositions and Lyrics | Rasika.life`,
    description: clamp(
      count > 0
        ? `Compositions by ${name}${count === 1 ? ': 1 composition' : `: ${count}${hasMore ? '+' : ''} compositions`} with lyrics, raga and tala. Read the lyrics in Roman, Devanagari, Tamil, Telugu or Kannada script.`
        : `Compositions by ${name} in Carnatic music, with lyrics, raga and tala where known.`
    ),
  };
}
