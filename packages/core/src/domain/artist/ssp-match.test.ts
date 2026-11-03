import { describe, expect, it } from 'vitest';
import {
  FLAG_DUPLICATE_TARGET,
  FLAG_JUNK_EXCLUDED,
  FLAG_MULTIPLE_EXACT,
  matchSspPeople,
  matchSspPerson,
} from './ssp-match';
import type { SspPerson } from './ssp-people';
import { searchedSpelling, sspNameKey } from './ssp-people';

const person = (iast: string, extra: Partial<SspPerson> = {}): SspPerson => ({
  key: sspNameKey(iast),
  name: searchedSpelling(iast),
  iastName: iast,
  alternateNames: [],
  facts: { works: [] },
  citations: [],
  gurus: [],
  composedCount: 0,
  volumes: [1],
  sspIds: [],
  scope: 'composer',
  roles: [],
  notes: [],
  ...extra,
});

const artist = (id: string, name: string, alternateNames?: string[]) => ({
  id,
  name,
  alternateNames,
});

const stored = [
  artist('muttu', 'Muttuswaamee Dikshitar'),
  artist('junk', 'Dikshitar'),
  artist('rama', 'Raamaswaamee Dikshitar'),
  artist('tyaga', 'Tyaagaraaja'),
  artist('syama', 'Shyaamaa Shaastree'),
  artist('subbaraya', 'Subbaraaya Shaastree'),
  artist('nayana', 'Nayana'),
];

describe('matchSspPerson', () => {
  it('matches Muttusvāmi to Muttuswaamee Dikshitar exactly and suggests attach', () => {
    const m = matchSspPerson(person('Muttusvāmi Dīkṣita', { composedCount: 221 }), stored);
    expect(m.tier).toBe('exact');
    expect(m.candidates.map(c => c.id)).toEqual(['muttu']);
    expect(m.suggestion).toBe('attach');
  });

  it('matches Vol 5’s Muddusvāmi, bare, as a close match for review', () => {
    const m = matchSspPerson(person('Muddusvāmi'), stored);
    expect(m.tier).toBe('close');
    expect(m.candidates[0].id).toBe('muttu');
    expect(m.suggestion).toBe('review');
  });

  it('does not let one Dīkṣita match every Dikshitar', () => {
    const m = matchSspPerson(person('Subbarāma Dīkṣita', { composedCount: 227 }), stored);
    expect(m.candidates).toEqual([]);
    expect(m.tier).toBe('none');
    // A composer with no match is pre-filled create.
    expect(m.suggestion).toBe('create');
    const r = matchSspPerson(person('Rāmasvāmi Dīkṣita', { composedCount: 18 }), stored);
    expect(r.candidates.map(c => c.id)).toEqual(['rama']);
  });

  it('never returns the bare Dikshitar record, and says it left it out', () => {
    const m = matchSspPerson(person('Bālasvāmi Dīkṣita'), stored);
    expect(m.candidates.map(c => c.id)).not.toContain('junk');
    expect(m.flags).toContain(FLAG_JUNK_EXCLUDED);
    expect(m.junkExcluded[0]).toContain('junk');
    for (const p of ['Muttusvāmi Dīkṣita', 'Rāmasvāmi Dīkṣita']) {
      expect(matchSspPerson(person(p), stored).candidates.map(c => c.id)).not.toContain('junk');
    }
  });

  it('matches the usual spellings of the other major names', () => {
    expect(matchSspPerson(person('Tyāgarāja'), stored).candidates[0]).toMatchObject({
      id: 'tyaga',
      tier: 'exact',
    });
    expect(matchSspPerson(person('Śyāmā Śāstri'), stored).candidates[0]).toMatchObject({
      id: 'syama',
      tier: 'exact',
    });
  });

  it('does not match Śāstri to Śāstri when the first names differ', () => {
    const m = matchSspPerson(person('Subbarāma Śāstri'), stored);
    expect(m.candidates.map(c => c.id)).not.toContain('subbaraya');
  });

  it('does not match Nannayya to Nayana', () => {
    const m = matchSspPerson(person('Nannayya'), stored);
    expect(m.candidates.map(c => c.id)).not.toContain('nayana');
  });

  it('ranks equal matches by compositions held', () => {
    const twin = [artist('a', 'Tyaagaraaja'), artist('b', 'Thyagaraja')];
    const m = matchSspPerson(person('Tyāgarāja'), twin, {
      compositionCounts: new Map([['b', 700]]),
    });
    expect(m.candidates.map(c => c.id)).toEqual(['b', 'a']);
    expect(m.flags).toContain(FLAG_MULTIPLE_EXACT);
    expect(m.suggestion).toBe('review');
  });

  it('matches on a stored alternate name', () => {
    const m = matchSspPerson(person('Vēṅkaṭamakhin'), [
      artist('v', 'Govindacharya', ['Venkatamakhi']),
    ]);
    expect(m.tier).toBe('exact');
  });

  it('ignores merged and deleted records', () => {
    const m = matchSspPerson(person('Tyāgarāja'), [
      { ...artist('x', 'Tyaagaraaja'), mergedIntoId: 'y' },
      { ...artist('z', 'Tyaagaraaja'), deletedAt: '2026-01-01' },
    ]);
    expect(m.candidates).toEqual([]);
  });

  it('suggests review, not create, for a name with a loose match only', () => {
    const m = matchSspPerson(person('Subbarāya Dīkṣita', { composedCount: 2 }), [
      artist('s', 'Subbarayan Iyer'),
    ]);
    expect(['loose', 'none']).toContain(m.tier);
    if (m.tier === 'loose') expect(m.suggestion).toBe('review');
  });

  it('leaves a biography subject with no match and no composition blank', () => {
    expect(matchSspPerson(person('Ahōbala'), stored).suggestion).toBe('review');
  });

  it('never attaches a person whose name carries a qualifier', () => {
    const m = matchSspPerson(person('Tyāgarāja', { qualifier: 'grandson of Tyāgarāja' }), stored);
    expect(m.tier).toBe('exact');
    expect(m.suggestion).toBe('review');
  });
});

describe('matchSspPeople', () => {
  it('flags two people that point at one stored artist, and attaches neither', () => {
    const ettendraA = person('Vēṅkaṭēśvara Eṭṭēndra Mahārājā', { composedCount: 1 });
    const ettendraB = person('Vēṅkaṭēśvara Eṭṭēndra Pāṇḍiya', { composedCount: 1 });
    expect(ettendraA.key).not.toBe(ettendraB.key);
    const rows = matchSspPeople([ettendraA, ettendraB], [artist('e', 'Venkateshwara Ettendra')]);
    for (const row of rows) {
      expect(row.flags).toContain(FLAG_DUPLICATE_TARGET);
      expect(row.suggestion).not.toBe('attach');
    }
  });

  it('keeps the two Eṭṭēndra rulers on their own stored records when both exist', () => {
    const rows = matchSspPeople(
      [person('Vēṅkaṭēśvara Eṭṭēndra Mahārājā'), person('Vēṅkaṭēśvara Eṭṭappa Mahārājā')],
      [
        artist('a', 'Venkateshwara Ettendra Maharaja'),
        artist('b', 'Venkateshwara Ettappa Maharaja'),
      ]
    );
    expect(rows[0].candidates[0].id).toBe('a');
    expect(rows[1].candidates[0].id).toBe('b');
    // The first name is shared, so the other ruler is a loose candidate at most.
    expect(rows[0].candidates.find(c => c.id === 'b')?.tier).toBe('loose');
    expect(rows[1].candidates.find(c => c.id === 'a')?.tier).toBe('loose');
    expect(rows.map(r => r.suggestion)).toEqual(['attach', 'attach']);
  });
});

describe('suggestions for people with no record of their own', () => {
  it('pre-fills create for a major composer whose only candidate shares a first name', () => {
    const m = matchSspPerson(person('Subbarāma Dīkṣita', { composedCount: 227 }), [
      artist('s', 'Subbaraama Aiyyar'),
    ]);
    expect(m.tier).toBe('loose');
    expect(m.suggestion).toBe('create');
  });

  it('leaves a lesser composer with a loose candidate for the reviewer', () => {
    const m = matchSspPerson(person('Pallavi Gōpālayyar', { composedCount: 2 }), [
      artist('p', 'Pallavi Gopaala Aiyyar'),
    ]);
    expect(m.suggestion).toBe('review');
  });
});

describe('karnatik.com spellings in the stored names', () => {
  const prod = [
    artist('pd', 'Purandara Daasar'),
    artist('st', 'Swaati TirunaaL'),
    artist('bc', 'Badraacala Raamadaas'),
    artist('pp', 'Ponniah Pillai'),
    artist('nt', 'NaaraayaNa Teertar'),
    artist('junk', 'Dikshitar'),
    artist('rs', 'Raamaswaamy Shivan'),
    artist('nay', 'Nayana'),
  ];
  const top = (iast: string, extra: Partial<SspPerson> = {}) =>
    matchSspPerson(person(iast, { composedCount: 1, ...extra }), prod);

  it('Purandaradāsa finds Purandara Daasar, spaced differently', () => {
    const m = top('Purandaradāsa');
    expect(m.candidates[0].id).toBe('pd');
    expect(m.suggestion).not.toBe('create');
  });

  it('Svātittirunāḷ Mahārājā finds Swaati TirunaaL', () => {
    const m = top('Svātittirunāḷ Mahārājā');
    expect(m.candidates[0].id).toBe('st');
    expect(m.suggestion).not.toBe('create');
  });

  it('Rāmadāsar, a subset of Badraacala Raamadaas, is a close match', () => {
    const m = top('Rāmadāsar');
    expect(m.candidates[0]).toMatchObject({ id: 'bc', tier: 'close' });
    expect(m.suggestion).toBe('review');
  });

  it('Ponnayya finds Ponniah Pillai, and Ponnaiyā is the same key', () => {
    expect(top('Ponnayya').candidates[0].id).toBe('pp');
    expect(sspNameKey('Ponnaiyā')).toBe(sspNameKey('Ponnayya'));
  });

  it('Nārāyaṇatīrtha Yatīndra and Nārāyaṇa Tīrtha both find Naaraayana Teertar', () => {
    expect(top('Nārāyaṇatīrtha Yatīndra').candidates[0].id).toBe('nt');
    expect(top('Nārāyaṇa Tīrtha').candidates[0].id).toBe('nt');
  });

  it('keeps the safeguards', () => {
    expect(top('Nannayya').candidates.map(c => c.id)).not.toContain('nay');
    expect(top('Rāmasvāmi Dīkṣita').candidates.find(c => c.id === 'rs')?.tier).toBe('loose');
    expect(top('Bālasvāmi Dīkṣita').candidates.map(c => c.id)).not.toContain('junk');
    expect(top('Dīkṣita').candidates).toEqual([]);
  });

  it('pre-fills create only when there is no candidate at any tier', () => {
    expect(top('Vēṅkaṭamakhi').suggestion).toBe('create');
    expect(top('Rāmasvāmi Dīkṣita').suggestion).toBe('review');
  });

  it('leaves an abbreviated, garbled or family name blank', () => {
    for (const n of ['K. Jagannātha Ceṭṭy', 'Akkul. Svāmi', 'Pollavaramuvāru']) {
      expect(top(n).suggestion).toBe('review');
    }
  });
});
