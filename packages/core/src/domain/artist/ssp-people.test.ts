import { describe, expect, it } from 'vitest';
import {
  type SspArtistRow,
  type SspRelationshipRow,
  type SspVolumeInput,
  buildSspPeople,
  cleanPlace,
  cleanWorkTitle,
  parseSspYear,
  searchedSpelling,
  splitQualifier,
  sspNameKey,
  sspPeopleLocator,
} from './ssp-people';

const row = (
  vol: number,
  slug: string,
  name: string,
  extra: Partial<SspArtistRow> = {}
): SspArtistRow => ({
  merged_provisional_id: `art_v${vol}_${slug}`,
  name_canonical: name,
  name_variants_seen: [name],
  roles_seen: [],
  attributes_consolidated: {},
  all_sources: [],
  ...extra,
});

const composedBy = (vol: number, work: string, slug: string): SspRelationshipRow => ({
  from: `comp_v${vol}_${work}`,
  to: `art_v${vol}_${slug}`,
  type: 'composed_by',
});

const manifest = (map: Record<number, number>) =>
  Object.fromEntries(Object.entries(map).map(([pdf, printed]) => [pdf, { printed_page: printed }]));

describe('names', () => {
  it('meets Muttusvāmi, Muddusvāmi and Muttuswaamee on one key', () => {
    const keys = ['Muttusvāmi Dīkṣita', 'Muddusvāmi Dīkṣita', 'Muttuswaamee Dikshitar'].map(
      sspNameKey
    );
    expect(new Set(keys).size).toBe(1);
  });

  it('meets Vēṅkaṭamakhi and Vēṅkaṭamakhin, and Dīkṣita and Dikshitar', () => {
    expect(sspNameKey('Vēṅkaṭamakhi')).toBe(sspNameKey('Vēṅkaṭamakhin'));
    expect(sspNameKey('Dīkṣita')).toBe(sspNameKey('Dikshitar'));
  });

  it('does not meet different first names under one lineage word', () => {
    expect(sspNameKey('Rāmasvāmi Dīkṣita')).not.toBe(sspNameKey('Muttusvāmi Dīkṣita'));
  });

  it('keeps a Muddu Vēṅkaṭamakhi apart from Vēṅkaṭamakhi', () => {
    expect(sspNameKey('Muddu Vēṅkaṭamakhi')).not.toBe(sspNameKey('Vēṅkaṭamakhi'));
    expect(sspNameKey('muttu Vēṅkaṭamakhi')).toBe(sspNameKey('Muddu Vēṅkaṭamakhi'));
  });

  it('splits a bracketed qualifier off', () => {
    expect(splitQualifier('Muddusvāmi (son of Subbarāma Dīkṣita)')).toEqual({
      base: 'Muddusvāmi',
      qualifier: 'son of Subbarāma Dīkṣita',
    });
    expect(splitQualifier('Tyāgarāja')).toEqual({ base: 'Tyāgarāja' });
  });

  it('suggests the spelling people type', () => {
    expect(searchedSpelling('Subbarāma Dīkṣita')).toBe('Subbarama Dikshitar');
    expect(searchedSpelling('Vēṅkaṭamakhin')).toBe('Venkatamakhi');
    expect(searchedSpelling('Muttusvāmi Dīkṣita')).toBe('Muttuswami Dikshitar');
    expect(searchedSpelling('Śyāmā Śāstri')).toBe('Shyama Shastri');
  });
});

describe('values', () => {
  it('reads an absolute year and keeps the śaka year apart', () => {
    expect(parseSspYear({ saka: 1692, ad: 1775, samvatsara: 'manmatha' })).toEqual({
      year: 1775,
      saka: 1692,
    });
    expect(parseSspYear('śaka 1761 (1839 A.D.), viḷambi year')).toEqual({ year: 1839, saka: 1761 });
    expect(parseSspYear(1859)).toEqual({ year: 1859 });
  });

  it('drops relative dates and years out of range', () => {
    expect(parseSspYear('passed away five years ago (relative to 1904; c. 1899)')).toBeUndefined();
    expect(parseSspYear('within the last two hundred years')).toBeUndefined();
    expect(parseSspYear({ ad: 1990 })).toBeUndefined();
    expect(parseSspYear('Tuḷaja’s time')).toBeUndefined();
  });

  it('cleans a place and refuses a sentence', () => {
    expect(
      cleanPlace('Eṭṭayapuram (third month after the wedding of the Mahārājā’s eldest son)')
    ).toBe('Eṭṭayapuram');
    expect(cleanPlace('Kayattāru, Tirunelvēli district')).toBe('Kayattāru');
    expect(cleanPlace('said to be in the north')).toBeUndefined();
    expect(cleanPlace('North India')).toBeUndefined();
  });

  it('keeps a work title and refuses the translators’ description of it', () => {
    expect(cleanWorkTitle('Kalānidhi (Kallinātha’s commentary on Saṅgīta Ratnākara)')).toBe(
      'Kalānidhi'
    );
    expect(cleanWorkTitle('Saṅgīta Svayam Bōdhini, 1892')).toBe('Saṅgīta Svayam Bōdhini');
    expect(cleanWorkTitle('a music book with notation in tamil, 1900')).toBeUndefined();
    expect(cleanWorkTitle('Rāmāyaṇa set in six khaṇḍas with varṇa meṭṭu')).toBeUndefined();
    expect(cleanWorkTitle('caturdaṇḍī prakāśika')).toBe('Caturdaṇḍī Prakāśika');
  });

  it('writes a locator from printed pages', () => {
    expect(sspPeopleLocator(5, [24])).toBe('Vol. 5, p. 24');
    expect(sspPeopleLocator(5, [25, 24])).toBe('Vol. 5, pp. 24–25');
    expect(sspPeopleLocator(5, [19, 24])).toBe('Vol. 5, pp. 19, 24');
    expect(sspPeopleLocator(5, [])).toBe('Vol. 5');
  });
});

describe('buildSspPeople', () => {
  const vol1: SspVolumeInput = {
    volume: 1,
    artists: [
      row(1, 'muttusvami', 'Muttusvāmi Dīkṣita', { roles_seen: ['composer'] }),
      row(1, 'balusvami', 'Bālusvāmi Dīkṣita', { roles_seen: ['composer'] }),
      row(1, 'bharata', 'Bharata'),
    ],
    relationships: [
      composedBy(1, 'a', 'muttusvami'),
      composedBy(1, 'b', 'muttusvami'),
      composedBy(1, 'b', 'muttusvami'),
      composedBy(1, 'c', 'balusvami'),
    ],
  };
  const vol5: SspVolumeInput = {
    volume: 5,
    printedPages: manifest({ 19: 14, 24: 19, 25: 20 }),
    artists: [
      row(5, 'muddusvami', 'Muddusvāmi Dīkṣita', {
        name_variants_seen: ['Muddusvāmi Dīkṣita', 'Muddusvāmi', 'Dīkṣita'],
        merged_from_provisional_ids: ['art_v5_p18_muddusvami'],
        attributes_consolidated: {
          section_number: { values: [36], sections: ['page-024'] },
          birth_date: { values: [{ saka: 1692, ad: 1775 }], sections: ['page-024'] },
          death_date: { values: [{ saka: 1757, ad: 1835 }], sections: ['page-025'] },
          birth_place: { values: ['Tiruvārūr'], sections: ['page-024'] },
          death_place: {
            values: ['Eṭṭayapuram (third month after the wedding)'],
            sections: ['page-025'],
          },
          mudra: { values: ['guruguha'], sections: ['page-025'] },
          caste: { values: ['a community'], sections: ['page-024'] },
          naming: {
            values: ['named after a god, after his parents prayed'],
            sections: ['page-019'],
          },
        },
      }),
      row(5, 'muddusvami-son', 'Muddusvāmi (son of Subbarāma Dīkṣita)', {
        attributes_consolidated: {
          music: { values: ['learned in music'], sections: ['page-019'] },
        },
      }),
      row(5, 'cidambaranatha', 'Cidambaranātha Yōgi'),
      row(5, 'edward', 'Edward VII', { attributes_consolidated: { role: { values: ['king'] } } }),
      row(5, 'acyutappa', 'Acyutappa Nāyaka', {
        attributes_consolidated: {
          role: { values: ['king'] },
          section_number: { values: [3], sections: ['page-024'] },
        },
      }),
      row(5, 'tulaja', 'Tuḷaja', {
        attributes_consolidated: { role: { values: ['king (Mahārājā)'] } },
      }),
    ],
    relationships: [
      {
        from: 'art_v5_muddusvami',
        to: 'art_v5_cidambaranatha',
        type: 'disciple_of',
        supporting_pages: [24],
        verbatim_quotes: [{ page: 24, quote: 'he initiated him into śrīvidyā mahā mantra' }],
      },
    ],
  };

  const result = buildSspPeople([vol1, vol5]);
  const byName = (n: string) => result.people.find(p => p.iastName.startsWith(n));

  it('joins Muttusvāmi (Vols 1) and Muddusvāmi (Vol 5) into one person', () => {
    const p = byName('Muttusvāmi') ?? byName('Muddusvāmi');
    expect(p).toBeDefined();
    expect(p?.volumes).toEqual([1, 5]);
    expect(result.people.filter(x => /Mu(tt|dd)usvāmi Dīkṣita/.test(x.iastName))).toHaveLength(1);
    expect(p?.composedCount).toBe(2);
  });

  it('takes the facts, in plain values, from the biography', () => {
    const p = byName('Mu');
    expect(p?.facts).toMatchObject({
      birthYear: 1775,
      deathYear: 1835,
      birthPlace: 'Tiruvārūr',
      deathPlace: 'Eṭṭayapuram',
      mudra: 'guruguha',
    });
    expect(Object.keys(p?.facts ?? {}).sort()).toEqual(
      ['birthPlace', 'birthYear', 'deathPlace', 'deathYear', 'mudra', 'works'].sort()
    );
    // Neither the caste value nor the naming sentence reaches the person.
    expect(JSON.stringify(p)).not.toMatch(/community|named after/);
  });

  it('cites each fact with its printed page', () => {
    const p = byName('Mu');
    const cite = (f: string) => p?.citations.find(c => c.field === f);
    expect(cite('birthYear')?.locator).toBe('Vol. 5, p. 19');
    expect(cite('birthYear')?.note).toBe('śaka 1692');
    expect(cite('deathYear')?.locator).toBe('Vol. 5, p. 20');
    expect(cite('mudra')?.sourceSlug).toBe('ssp-2008-english');
  });

  it('gives a new record the searched spelling and keeps the IAST as an alternate', () => {
    const p = byName('Mu');
    expect(p?.name).toBe('Muttuswami Dikshitar');
    expect(p?.alternateNames).toContain('Muddusvāmi Dīkṣita');
    // The lone lineage word is not a spelling of the name.
    expect(p?.alternateNames).not.toContain('Dīkṣita');
    expect(p?.alternateNames).not.toContain('Muddusvāmi');
  });

  it('marks a mantra-initiation guru spiritual and resolves nobody out of scope', () => {
    const p = byName('Mu');
    expect(p?.gurus).toHaveLength(1);
    expect(p?.gurus[0]).toMatchObject({ iastName: 'Cidambaranātha Yōgi', spiritual: true });
    expect(p?.gurus[0].guruKey).toBeUndefined();
    expect(p?.citations.find(c => c.field === 'gurus')?.note).toBe(p?.gurus[0].name);
  });

  it('keeps the son, who has a qualifier, out of the father’s record', () => {
    expect(result.people.some(x => x.qualifier)).toBe(false);
    expect(
      result.skipped.some(s => s.name.startsWith('Muddusvāmi') && s.reason.includes('Vol 5'))
    ).toBe(true);
  });

  it('skips royals and rulers who composed nothing, and keeps a composer-ruler', () => {
    expect(result.skipped.find(s => s.name === 'Edward VII')?.reason).toMatch(/not a person/);
    expect(result.skipped.find(s => s.name === 'Acyutappa Nāyaka')?.reason).toMatch(/ruler/);
    expect(byName('Tuḷaja')).toBeDefined();
  });

  it('skips a name with no composition and no biography', () => {
    expect(result.skipped.find(s => s.name === 'Bharata')?.reason).toMatch(/not a composer/);
  });
});

describe('same name, different people', () => {
  it('keeps the two Eṭṭēndra rulers apart even when a variant and a review row join them', () => {
    const a = row(1, 'ett-a', 'Vēṅkaṭēśvara Eṭṭēndra Mahārājā', {
      roles_seen: ['composer'],
      name_variants_seen: ['Vēṅkaṭēśvara Eṭṭēndra Mahārājā'],
    });
    const b = row(2, 'ett-b', 'Vēṅkaṭēśvara Eṭṭēndra Pāṇḍiya', {
      roles_seen: ['composer'],
      name_variants_seen: ['Vēṅkaṭēśvara Eṭṭēndra Pāṇḍiya', 'Vēṅkaṭēśvara Eṭṭēndra Mahārājā'],
    });
    const r = buildSspPeople([
      { volume: 1, artists: [a], relationships: [composedBy(1, 'x', 'ett-a')] },
      {
        volume: 2,
        artists: [b],
        relationships: [composedBy(2, 'y', 'ett-b')],
        reviews: [
          {
            kind: 'possible_same_person',
            detail: ['Vēṅkaṭēśvara Eṭṭēndra Mahārājā', 'Vēṅkaṭēśvara Eṭṭēndra Pāṇḍiya'],
          },
        ],
      },
    ]);
    expect(r.people).toHaveLength(2);
  });

  it('keeps a Vol 5 pair apart that SSP’s own review lists as possibly one person', () => {
    const mk = (slug: string, name: string) =>
      row(5, slug, name, {
        attributes_consolidated: { mudra: { values: [slug], sections: [] } },
      });
    const r = buildSspPeople([
      {
        volume: 5,
        artists: [mk('gk', 'Ghanam Kṛṣṇayya'), mk('gs', 'Ghanam Sīnayya')],
        relationships: [],
        reviews: [{ kind: 'possible_same_person', detail: ['Ghanam Kṛṣṇayya', 'Ghanam Sīnayya'] }],
      },
    ]);
    expect(r.people).toHaveLength(2);
  });

  it('joins spelling variants SSP lists as possibly one person', () => {
    const r = buildSspPeople([
      {
        volume: 1,
        artists: [
          row(1, 'a', 'Bālasvāmi Dīkṣita', { roles_seen: ['composer'] }),
          row(1, 'b', 'Bālusvāmi Dīkṣita', { roles_seen: ['composer'] }),
        ],
        relationships: [composedBy(1, 'x', 'a'), composedBy(1, 'y', 'b')],
        reviews: [
          { kind: 'possible_same_person', detail: ['Bālasvāmi Dīkṣita', 'Bālusvāmi Dīkṣita'] },
        ],
      },
    ]);
    expect(r.people).toHaveLength(1);
    expect(r.people[0].composedCount).toBe(2);
  });

  it('joins a Vol 5 section row to a Vols 1–4 composer through a variant, but not two sections', () => {
    const r = buildSspPeople([
      {
        volume: 1,
        artists: [row(1, 'k', 'Kumāra Eṭṭappa Mahārājā', { roles_seen: ['composer'] })],
        relationships: [composedBy(1, 'x', 'k')],
      },
      {
        volume: 5,
        artists: [
          row(5, 'vc67', 'Jagadvīra Rāmakumāra Eṭṭappa (VC §67)', {
            name_variants_seen: [
              'Jagadvīra Rāmakumāra Eṭṭappa (VC §67)',
              'Kumāra Eṭṭappa Mahārājā',
              'this Mahārājā',
            ],
            attributes_consolidated: { mudra: { values: ['śrī kārtikēya'], sections: [] } },
          }),
          row(5, 'vc70', 'Rājā Jagadvīra Rāmakumāra Eṭṭappa (VC §70)', {
            attributes_consolidated: { mudra: { values: ['x'], sections: [] } },
          }),
        ],
        relationships: [],
      },
    ]);
    const joined = r.people.filter(p => p.volumes.includes(1));
    expect(joined).toHaveLength(1);
    expect(joined[0].volumes).toEqual([1, 5]);
    expect(r.people).toHaveLength(2);
  });
});

describe('gurus', () => {
  it('reads guru_of backwards, drops an unresolved end and counts one edge once', () => {
    const mk = (slug: string, name: string) =>
      row(5, slug, name, { attributes_consolidated: { mudra: { values: [slug], sections: [] } } });
    const r = buildSspPeople([
      {
        volume: 5,
        artists: [mk('teacher', 'Gurudatta Ayya'), mk('pupil', 'Sishya Ayya')],
        relationships: [
          { from: 'art_v5_teacher', to: 'art_v5_pupil', type: 'guru_of', supporting_pages: [] },
          { from: 'art_v5_pupil', to: 'art_v5_teacher', type: 'disciple_of', supporting_pages: [] },
          { from: 'art_v5_pupil', to: 'unresolved:unnamed saint', type: 'initiated_by' },
        ],
      },
    ]);
    const pupil = r.people.find(p => p.iastName === 'Sishya Ayya');
    expect(pupil?.gurus).toHaveLength(1);
    expect(pupil?.gurus[0].spiritual).toBe(false);
    expect(pupil?.gurus[0].guruKey).toBe(r.people.find(p => p.iastName === 'Gurudatta Ayya')?.key);
    expect(r.stats.guruEdgesUnresolved).toBe(1);
  });
});

describe('spelling repairs and spacing joins', () => {
  it('restores the ṣ SSP drops before an m', () => {
    expect(searchedSpelling('Lakṃīkānta Mahārāju')).toBe('Lakshmikanta Maharaju');
    expect(searchedSpelling('Lakṣmaṇācārya')).toBe('Lakshmanacharya');
  });

  it('joins one name written with different spacing, and Ponnayya with Ponnaiyā', () => {
    const mk = (vol: number, slug: string, name: string) =>
      row(vol, slug, name, { roles_seen: ['composer'] });
    const r = buildSspPeople([
      {
        volume: 3,
        artists: [mk(3, 'p', 'Ponnaiyā'), mk(3, 'n', 'Nārāyaṇatīrtha Yatīndra')],
        relationships: [composedBy(3, 'a', 'p'), composedBy(3, 'b', 'n')],
      },
      {
        volume: 5,
        artists: [
          row(5, 'p5', 'Ponnayya', { attributes_consolidated: { mudra: { values: ['x'] } } }),
          row(5, 'n5', 'Nārāyaṇa Tīrtha', {
            attributes_consolidated: { mudra: { values: ['y'] } },
          }),
        ],
        relationships: [],
      },
    ]);
    expect(r.people).toHaveLength(2);
    expect(r.people.every(p => p.volumes.join() === '3,5')).toBe(true);
  });
});
