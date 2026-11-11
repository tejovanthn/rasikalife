import { describe, expect, it } from 'vitest';
import {
  composerCompositionsMeta,
  groupJanyaByParent,
  janyaListMeta,
  melakartaListMeta,
  melakartaRows,
  varnamListMeta,
} from './hub-lists';
import { MELAKARTA_LINKS } from './melakarta-links';

describe('melakartaRows', () => {
  it('returns all 72 in order with chakra and scale', () => {
    const rows = melakartaRows(MELAKARTA_LINKS);
    expect(rows).toHaveLength(72);
    expect(rows.map(r => r.mela)).toEqual(Array.from({ length: 72 }, (_, i) => i + 1));
    expect(rows[0]).toMatchObject({ mela: 1, chakra: 1, chakraName: 'Indu' });
    expect(rows[28].scale).toBe('S R2 G3 M1 P D2 N3 S');
    expect(rows[71]).toMatchObject({ chakra: 12, chakraName: 'Aditya' });
  });

  it('skips a number with no linked record', () => {
    const rows = melakartaRows({ 1: { id: 'a', name: 'kanakAngi' } });
    expect(rows.map(r => r.mela)).toEqual([1]);
  });
});

describe('groupJanyaByParent', () => {
  const links = {
    1: { id: 'p1', name: 'kanakAngi' },
    2: { id: 'p2', name: 'ratnAngi' },
  };
  const janya = (id: string, name: string, parentId: string) => ({
    id,
    name,
    parentRaga: { id: parentId, name: 'x' },
  });

  it('groups by parent in mela order and sorts each group by name', () => {
    const groups = groupJanyaByParent(
      [janya('c', 'zeta', 'p2'), janya('a', 'beta', 'p1'), janya('b', 'alpha', 'p1')],
      links
    );
    expect(groups.map(g => g.mela)).toEqual([1, 2]);
    expect(groups[0].janyas.map(j => j.name)).toEqual(['alpha', 'beta']);
    expect(groups[0].parentName).toBe('kanakAngi');
  });

  it('drops a raga whose parent is not a melakarta, and a raga that is its own parent', () => {
    const groups = groupJanyaByParent([janya('a', 'a', 'other'), janya('p1', 'self', 'p1')], links);
    expect(groups).toEqual([]);
  });
});

describe('meta builders', () => {
  it('melakarta list title carries the head term', () => {
    expect(melakartaListMeta().title).toContain('Melakarta Ragas');
  });

  it('janya meta states counts only when there are ragas', () => {
    expect(janyaListMeta({ ragas: 900, parents: 70 }).description).toContain('900 janya ragas');
    expect(janyaListMeta({ ragas: 0, parents: 0 }).description).not.toMatch(/\d/);
  });

  it('varnam meta states the count only when there is one', () => {
    expect(varnamListMeta(12).description).toContain('12 Carnatic varnams');
    expect(varnamListMeta(0).description).not.toMatch(/\d/);
    expect(varnamListMeta(5).title).toContain('Varnam Lyrics');
  });

  it('composer title is "<Composer> Compositions and Lyrics" and stays in length', () => {
    const m = composerCompositionsMeta({ name: 'Purandara Dasa' }, 36, true);
    expect(m.title).toBe('Purandara Dasa Compositions and Lyrics | Rasika.life');
    expect(m.description.length).toBeLessThanOrEqual(155);
    expect(m.description).toContain('36+ compositions');
    expect(composerCompositionsMeta({ name: 'A' }, 20).description).toContain(': 20 compositions');
    expect(composerCompositionsMeta({ name: 'A' }, 1).description).toContain('1 composition');
    expect(composerCompositionsMeta({ name: 'A' }, 0).description).not.toMatch(/\d/);
  });
});
