import { describe, expect, it } from 'vitest';
import type { SspPerson } from './ssp-people';
import {
  type SspStoredArtist,
  citationKey,
  mergeCitations,
  planSspCreatedUndo,
  planSspPersonAttach,
  planSspPersonCreate,
  planSspPersonUndo,
} from './ssp-people-apply';

const SLUG = 'ssp-2008-english';
const cite = (field: string, locator: string, note?: string) => ({
  field,
  sourceSlug: SLUG,
  locator,
  ...(note ? { note } : {}),
});

const muttu: SspPerson = {
  key: 'muddusvami diksita',
  name: 'Muttuswami Dikshitar',
  iastName: 'Muttusvāmi Dīkṣita',
  alternateNames: ['Muddusvāmi Dīkṣita'],
  facts: {
    birthYear: 1775,
    deathYear: 1835,
    birthPlace: 'Tiruvārūr',
    deathPlace: 'Eṭṭayapuram',
    mudra: 'guruguha',
    works: ['Caturdaṇḍī Prakāśikā'],
  },
  citations: [
    cite('birthYear', 'Vol. 5, p. 19', 'śaka 1692'),
    cite('deathYear', 'Vol. 5, p. 20'),
    cite('birthPlace', 'Vol. 5, p. 19'),
    cite('deathPlace', 'Vol. 5, p. 20'),
    cite('mudra', 'Vol. 5, p. 20'),
    cite('works', 'Vol. 1, p. 12', 'Caturdaṇḍī Prakāśikā'),
    cite('alternateNames', 'Vol. 5, p. 19'),
    cite('gurus', 'Vol. 5, p. 19', 'Chidambaranatha Yogi'),
    cite('gurus', 'Vol. 5, p. 15', 'Sonti Venkataramanayya'),
  ],
  gurus: [
    { name: 'Chidambaranatha Yogi', iastName: 'Cidambaranātha Yōgi', spiritual: true },
    {
      name: 'Sonti Venkataramanayya',
      iastName: 'Soṇṭi Vēṅkaṭaramaṇayya',
      spiritual: false,
      guruKey: 'sonti',
    },
  ],
  composedCount: 221,
  volumes: [1, 5],
  sspIds: [],
  scope: 'both',
  roles: [],
  notes: [],
};

const resolve = (key: string | undefined) =>
  key === 'sonti' ? { id: 'g-sonti', name: 'Sonti Venkataramanayya' } : undefined;

describe('planSspPersonCreate', () => {
  it('uses the searched spelling as name and the IAST as an alternate', () => {
    const { input } = planSspPersonCreate(muttu, { resolveGuru: resolve });
    expect(input.name).toBe('Muttuswami Dikshitar');
    expect(input.alternateNames).toEqual(['Muttusvāmi Dīkṣita', 'Muddusvāmi Dīkṣita']);
    expect(input).toMatchObject({
      isHistorical: true,
      birthYear: 1775,
      deathYear: 1835,
      mudra: 'guruguha',
    });
  });

  it('takes a name the reviewer chose and moves the suggestion into the alternates', () => {
    const { input } = planSspPersonCreate(muttu, { name: 'Muthuswami Dikshitar' });
    expect(input.name).toBe('Muthuswami Dikshitar');
    expect(input.alternateNames).toContain('Muttuswami Dikshitar');
  });

  it('writes guru rows with the printed-source marker and the spiritual relationship', () => {
    const { input } = planSspPersonCreate(muttu, { resolveGuru: resolve });
    expect(input.gurus).toEqual([
      { name: 'Chidambaranatha Yogi', relationship: 'spiritual', source: 'published-source' },
      { id: 'g-sonti', name: 'Sonti Venkataramanayya', source: 'published-source' },
    ]);
  });

  it('cites only the fields it writes', () => {
    const bare: SspPerson = { ...muttu, facts: { works: [] }, gurus: [], alternateNames: [] };
    const { input, citations } = planSspPersonCreate({ ...bare, iastName: bare.name });
    expect(input).not.toHaveProperty('birthYear');
    expect(citations.map(c => c.field)).toEqual([]);
  });
});

describe('planSspPersonAttach', () => {
  const stored: SspStoredArtist = {
    id: 'a1',
    name: 'Muttuswaamee Dikshitar',
    gurus: [{ name: 'Sonti Venkataramanayya', relationship: 'primary', source: 'press' }],
    works: [{ title: 'Some other work' }],
    alternateNames: ['Dikshitar Muthuswami'],
  };

  it('fills what is empty and adds the IAST as an alternate name', () => {
    const plan = planSspPersonAttach(muttu, stored, { resolveGuru: resolve });
    expect(plan.update).toMatchObject({
      birthYear: 1775,
      deathYear: 1835,
      birthPlace: 'Tiruvārūr',
      deathPlace: 'Eṭṭayapuram',
      mudra: 'guruguha',
      isHistorical: true,
    });
    expect(plan.update.alternateNames).toEqual([
      'Dikshitar Muthuswami',
      'Muttusvāmi Dīkṣita',
      'Muttuswami Dikshitar',
      'Muddusvāmi Dīkṣita',
    ]);
  });

  it('never overwrites a stored value and holds it instead', () => {
    const plan = planSspPersonAttach(muttu, { ...stored, birthYear: 1776, mudra: 'guruguha' });
    expect(plan.update).not.toHaveProperty('birthYear');
    expect(plan.held).toEqual([expect.objectContaining({ field: 'birthYear', value: 1775 })]);
    // Agreeing with SSP is not a change, but the citation still lands.
    expect(plan.changes).not.toHaveProperty('mudra');
    expect(plan.citationsAdded.some(c => c.field === 'mudra')).toBe(true);
    expect(plan.citationsAdded.some(c => c.field === 'birthYear')).toBe(false);
  });

  it('merges gurus and works onto the stored rows and drops none', () => {
    const plan = planSspPersonAttach(muttu, stored, { resolveGuru: resolve });
    const gurus = plan.update.gurus as {
      name: string;
      id?: string;
      relationship?: string;
      source?: string;
    }[];
    expect(gurus).toHaveLength(2);
    // The stored row keeps its own relationship and source; it only gains the id we resolved.
    expect(gurus[0]).toEqual({
      name: 'Sonti Venkataramanayya',
      relationship: 'primary',
      source: 'press',
      id: 'g-sonti',
    });
    expect(gurus[1]).toMatchObject({ name: 'Chidambaranatha Yogi', relationship: 'spiritual' });
    expect((plan.update.works as { title: string }[]).map(w => w.title)).toEqual([
      'Some other work',
      'Caturdaṇḍī Prakāśikā',
    ]);
  });

  it('does not add a work or a guru the record already holds', () => {
    const plan = planSspPersonAttach(
      muttu,
      {
        ...stored,
        gurus: [...stored.gurus!, { name: 'Cidambaranatha Yogi', id: 'c1' }],
        works: [{ title: 'Caturdandi Prakashika' }],
      },
      { resolveGuru: resolve }
    );
    expect((plan.update.gurus as unknown[]) ?? []).toHaveLength(2);
    expect(plan.update).not.toHaveProperty('works');
  });

  it('merges citations onto the stored ones and keeps every stored one', () => {
    const existing = cite('birthYear', 'Vol. 1, p. 1');
    const plan = planSspPersonAttach(muttu, { ...stored, citations: [existing] });
    const merged = plan.update.citations as { field: string; locator: string }[];
    expect(merged[0]).toEqual(existing);
    expect(merged.length).toBeGreaterThan(1);
    // Running the same patch on the result adds nothing.
    const again = planSspPersonAttach(muttu, {
      ...stored,
      ...(plan.update as object),
    });
    expect(again.citationsAdded).toEqual([]);
    expect(again.update).not.toHaveProperty('citations');
    expect(Object.keys(again.changes)).toEqual([]);
  });

  it('writes no empty or undefined keys', () => {
    const plan = planSspPersonAttach(
      { ...muttu, facts: { works: [] }, citations: [], gurus: [] },
      { ...stored, isHistorical: true }
    );
    expect(Object.values(plan.update).every(v => v !== undefined)).toBe(true);
  });
});

describe('mergeCitations', () => {
  it('treats the same field, source, locator and note as one', () => {
    const c = cite('gurus', 'Vol. 5, p. 1', 'x');
    expect(citationKey(c)).toBe(citationKey({ ...c }));
    expect(mergeCitations([c], [c, cite('gurus', 'Vol. 5, p. 1', 'y')]).added).toHaveLength(1);
  });
});

describe('planSspPersonUndo', () => {
  const stored: SspStoredArtist = {
    id: 'a1',
    name: 'Muttuswaamee Dikshitar',
    gurus: [{ name: 'Sonti Venkataramanayya', relationship: 'primary' }],
    alternateNames: ['Dikshitar Muthuswami'],
    citations: [cite('birthYear', 'Vol. 1, p. 1')],
  };
  const plan = planSspPersonAttach(muttu, stored, { resolveGuru: resolve });
  const entry = { changes: plan.changes, citationsAdded: plan.citationsAdded };
  const after = { ...stored, ...plan.update };

  it('puts the record back as it was', () => {
    const undo = planSspPersonUndo(entry, after as never);
    expect(undo.skipped).toEqual([]);
    expect(undo.remove.sort()).toEqual(
      ['birthPlace', 'birthYear', 'deathPlace', 'deathYear', 'isHistorical', 'mudra']
        .sort()
        .concat(undo.remove.includes('works') ? ['works'] : [])
        .sort()
    );
    expect(undo.set.alternateNames).toEqual(['Dikshitar Muthuswami']);
    expect(undo.set.gurus).toEqual([{ name: 'Sonti Venkataramanayya', relationship: 'primary' }]);
    expect(undo.set.citations).toEqual([cite('birthYear', 'Vol. 1, p. 1')]);
  });

  it('keeps a value that was edited since', () => {
    const undo = planSspPersonUndo(entry, { ...after, mudra: 'something else' } as never);
    expect(undo.skipped).toEqual([{ field: 'mudra', reason: 'changed since the import' }]);
    expect(undo.remove).not.toContain('mudra');
  });

  it('keeps a guru row added by someone else after the import', () => {
    const undo = planSspPersonUndo(entry, {
      ...after,
      gurus: [...(after.gurus as unknown[]), { name: 'New Teacher' }],
    } as never);
    expect(undo.set.gurus).toEqual([
      { name: 'Sonti Venkataramanayya', relationship: 'primary' },
      { name: 'New Teacher' },
    ]);
  });
});

describe('planSspCreatedUndo', () => {
  it('deletes only when nothing links to the record', () => {
    expect(planSspCreatedUndo({ compositions: 0, events: 0, gurusReferencing: 0 })).toEqual({
      delete: true,
      reasons: [],
    });
    const kept = planSspCreatedUndo({ compositions: 4, events: 0, gurusReferencing: 1 });
    expect(kept.delete).toBe(false);
    expect(kept.reasons).toHaveLength(2);
  });
});
