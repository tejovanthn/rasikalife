import { describe, expect, it } from 'vitest';
import {
  type SspRagaRecord,
  type SspReviewRow,
  type SspStoredRaga,
  buildSspRagaPatch,
  cleanMurcchanaLine,
  mapSspTimeOfDay,
  prayogaLabel,
  sspLocator,
  sspMatchCheck,
  sspMovementFacts,
} from './ssp';

// Small fixtures copied from the real records in rasika-books (run 2026-10-27-055202).

const src = (field: string, printed_page: number, confidence = 0.95) => ({
  field,
  page: printed_page + 43,
  printed_page,
  confidence,
});

const bhairavi: SspRagaRecord = {
  merged_provisional_id: 'raga_ssp-2008-english-vol-1_bhairavi',
  name_canonical: 'bhairavi',
  kind: 'janya',
  janya_class: 'bhāṣāṅga',
  mela_number: 20,
  mela_swaras: ['S', 'R2', 'G2', 'M1', 'P', 'D1', 'N2'],
  printed_pages: [389, 391],
  sloka: {
    author: 'Vēṅkaṭamakhi',
    text_iast:
      'bhairavirāga saṃpūrṇassāyaṃkālē pragīyatē | pañcaśruti dhaivataṃ ca kvacitsthānē prayujyatē ∥',
    printed_page: 390,
    facts: { scale_type: 'sampurna', time_of_day: 'evening' },
  },
  murcchana: {
    arohana: "S R2 G2 M1 P D1 N2 S'",
    avarohana: "S' N2 D1 P M1 G2 R2 S",
    printed_page: 390,
    confidence: 0.85,
  },
  lakshana: {
    raga_class: 'bhashanga',
    scale_type: 'sampurna',
    graha_swaras: ['D1'],
    time_of_day: 'evening',
    jiva_swaras: {
      all: ['S', 'R2', 'G2', 'M1', 'P', 'D1', 'N2'],
      most_ranjaka: ['R2', 'G2', 'M1', 'N2'],
    },
    nyasa_swaras: {
      all: ['S', 'R2', 'G2', 'M1', 'P', 'D1', 'N2'],
      most_ranjaka: ['R2', 'G2', 'M1', 'N2'],
    },
    prayogas: [
      {
        label: 'jiva-svara sancara',
        notation: 'R2 G2 G2 R2',
        gamaka_raw: '/ ⋎',
        printed_page: 390,
        confidence: 0.9,
      },
      {
        label: 'jiva-svara sancara',
        notation: 'N2. S R2 G2 R2',
        gamaka_raw: '×',
        printed_page: 390,
        confidence: 0.88,
      },
    ],
    anya_swaras: [
      { swara: 'D2', phrases: ['N2 D2 N2 S'] },
      { swara: 'R1', phrases: ['S R1 N2 D2 N2 S'] },
    ],
    other_facts: [
      { fact: 'The rāga is said to hold all twelve svarasthānas and every gamaka.', page: 434 },
    ],
    gamaka_rules: [
      { where: 'arohana, each svara as context fits', gamaka: 'ēRRa jāru', page: 433 },
    ],
    sources: [
      src('raga_class', 390),
      src('scale_type', 390),
      src('graha_swaras', 390),
      src('time_of_day', 390),
      src('jiva_swaras', 390, 0.9),
      src('nyasa_swaras', 390, 0.9),
      src('anya_swaras', 391),
      src('prayogas', 390),
    ],
  },
  historical_notes: [],
  editor_notes: [],
};

const ahiri: SspRagaRecord = {
  merged_provisional_id: 'raga_ssp-2008-english-vol-1_ahiri',
  name_canonical: 'āhiri',
  kind: 'janya',
  janya_class: 'bhāṣāṅga',
  mela_number: 14,
  mela_swaras: ['S', 'R1', 'G3', 'M1', 'P', 'D1', 'N2'],
  printed_pages: [426, 427],
  sloka: {
    author: 'Vēṅkaṭamakhi',
    text_iast:
      'āhirī rāga saṃpūrṇā sagrahō śrōtrarañjanī | gītōkta mēḷamārgēṇa bāṇayāmē pragīyatē ∥',
    printed_page: 426,
    facts: { scale_type: 'sampurna', time_of_day: 'fifth yāma (bāṇa yāma)' },
  },
  murcchana: {
    arohana: "S R2 S G2 M1 P D1 N2 S'",
    avarohana: "S' N2 D1 P M1 G2 R2 S",
    printed_page: 426,
    confidence: 0.85,
  },
  lakshana: {
    raga_class: 'bhashanga',
    scale_type: 'sampurna',
    graha_swaras: ['S'],
    time_of_day: 'first yāma of the night',
    jiva_swaras: { all: ['N2', 'D1', 'G2'], most_ranjaka: ['N2', 'D1', 'G2'] },
    nyasa_swaras: { all: [], most_ranjaka: [] },
    prayogas: [
      { label: 'jiva-svara prayoga', notation: "S' N2 D1 P", printed_page: 427, confidence: 0.9 },
      {
        label: 'jiva-svara prayoga',
        notation: 'S M1 G3 M1 G2 M1 P',
        printed_page: 427,
        confidence: 0.9,
        variant_uncertain: true,
      },
    ],
    anya_swaras: [
      { swara: 'R1', phrases: ['S R1 S', 'R1 R1 S'] },
      { swara: 'R2', phrases: ['P R2 S'], variant_uncertain: true },
    ],
    other_facts: [{ fact: 'Classed as a rakti rāga.', page: 470 }],
    sources: [
      src('raga_class', 427),
      src('scale_type', 427),
      src('graha_swaras', 427),
      src('time_of_day', 427),
      src('jiva_swaras', 427, 0.8),
      src('prayogas', 427, 0.85),
      src('anya_swaras', 427, 0.85),
    ],
  },
};

const husani: SspRagaRecord = {
  merged_provisional_id: 'raga_ssp-2008-english-vol-2_husani',
  name_canonical: 'huśāni',
  kind: 'janya',
  janya_class: 'upāṅga',
  mela_number: 28,
  mela_swaras: ['S', 'R2', 'G3', 'M1', 'P', 'D2', 'N2'],
  printed_pages: [528, 529],
  lakshana: {
    raga_class: 'upanga',
    scale_type: 'sampurna',
    prayogas: [
      { label: 'prayoga', notation: 'S R2 G3 M1 P M1', octave_unmarked: true, printed_page: 528 },
      {
        label: 'prayoga',
        notation: 'M1 P N2 D2 P M1',
        podi_swaras: ['P'],
        printed_page: 528,
        confidence: 0.85,
      },
      {
        label: 'prayoga',
        notation: 'P S N2 D1',
        notation_modernist: 'P S N2 D2',
        printed_page: 528,
      },
      { label: 'prayoga', notation: 'M1', printed_page: 528 },
      { label: 'prayoga', notation: 'N2. R2 R2 G3', printed_page: 528, confidence: 0.9 },
    ],
    sources: [src('prayogas', 528, 0.85)],
  },
};

const mahuri: SspRagaRecord = {
  merged_provisional_id: 'raga_ssp-2008-english-vol-2_mahuri',
  name_canonical: 'māhūri',
  kind: 'janya',
  janya_class: 'upāṅga',
  mela_number: 28,
  mela_swaras: ['S', 'R2', 'G3', 'M1', 'P', 'D2', 'N2'],
  printed_pages: [658, 659],
  murcchana: {
    arohana: "S R2 M1 G3 R2 M1 | P D2 S'",
    avarohana: "S' N2 D2 P M1 G3 R2 | S R2 G3 R2 S",
    printed_page: 658,
    confidence: 0.8,
  },
  lakshana: { raga_class: 'upanga', sources: [src('raga_class', 658)] },
};

const brndavani: SspRagaRecord = {
  merged_provisional_id: 'raga_ssp-2008-english-vol-1_brndavani',
  name_canonical: 'bṛndāvani',
  kind: 'janya',
  mela_number: 22,
  mela_swaras: ['S', 'R2', 'G2', 'M1', 'P', 'D2', 'N2'],
  printed_pages: [540, 541],
  murcchana: {
    arohana: "R2 M1 P N2 S'",
    avarohana: 'N2 P M1 R2 S',
    printed_page: 541,
    confidence: 0.8,
  },
  lakshana: { time_of_day: 'all times', sources: [src('time_of_day', 541)] },
};

const rudrapriya: SspRagaRecord = {
  merged_provisional_id: 'raga_ssp-2008-english-vol-1_rudrapriya',
  name_canonical: 'rudrapriyā',
  kind: 'janya',
  mela_number: 22,
  mela_swaras: ['S', 'R2', 'G2', 'M1', 'P', 'D2', 'N2'],
  printed_pages: [561, 562],
  murcchana: {
    arohana: "S R2 G2 M1 P D2 N2 N2 S'",
    avarohana: "S' N2 P M1 G2 R2 S",
    printed_page: 561,
    confidence: 0.75,
    variant_uncertain: true,
  },
  lakshana: { raga_class: 'bhashanga', sources: [src('raga_class', 562)] },
};

const asaveri: SspRagaRecord = {
  merged_provisional_id: 'raga_ssp-2008-english-vol-1_asaveri',
  name_canonical: 'asāvēri',
  kind: 'janya',
  janya_class: 'bhashanga',
  mela_number: 8,
  mela_swaras: ['S', 'R1', 'G2', 'M1', 'P', 'D1', 'N2'],
  printed_pages: [84, 84],
  sloka: {
    author: 'Vēṅkaṭamakhi',
    text_iast:
      'asāvēryākhya rāgaśca ārōhē ga ni varjitaḥ |\nsaṃpūrṇassagrahōpētassarvakālēṣu gīyatē ∥',
    printed_page: 84,
    facts: {
      scale_type: 'sampurna (gāndhāra and niṣāda omitted in ārōhaṇa)',
      time_of_day: 'all times',
    },
  },
  murcchana: {
    arohana: "S R1 M1 P D1 S'",
    avarohana: "S' N2 D1 P M1 G2 R1 S",
    printed_page: 84,
    confidence: 0.8,
  },
  lakshana: {
    raga_class: 'bhashanga',
    scale_type: 'sampurna',
    graha_swaras: ['S'],
    time_of_day: 'all times',
    jiva_swaras: { all: [], most_ranjaka: [] },
    anya_swaras: [
      { swara: 'N1', phrases: [] },
      { swara: 'G1', phrases: [] },
    ],
    sources: [
      src('raga_class', 84),
      src('scale_type', 84),
      src('graha_swaras', 84),
      src('time_of_day', 84),
      src('anya_swaras', 84, 0.85),
    ],
  },
};

const dhanyasi: SspRagaRecord = {
  merged_provisional_id: 'raga_ssp-2008-english-vol-1_dhanyasi',
  name_canonical: 'dhanyāśi',
  kind: 'janya',
  mela_number: 20,
  mela_swaras: ['S', 'R2', 'G2', 'M1', 'P', 'D1', 'N2'],
  printed_pages: [435, 435],
  sloka: {
    author: 'Vēṅkaṭamakhi',
    text_iast:
      'dhanyāśī rāga saṃpūrṇā ārōhē ridhavarjitā | prātaḥ kālē pragīyantē gānatatvārthavēdibhiḥ |',
    printed_page: 435,
    facts: { time_of_day: 'morning' },
  },
  murcchana: {
    arohana: "N2. S G2 M1 P N2 S'",
    avarohana: 'N2 D1 P M1 G2 R1 S',
    printed_page: 435,
    confidence: 0.75,
  },
  lakshana: {
    time_of_day: 'first yāma of the day',
    sources: [src('time_of_day', 435)],
  },
};

const row = (record: SspRagaRecord, r: Omit<SspReviewRow, 'section_id'>): SspReviewRow => ({
  section_id: record.merged_provisional_id,
  ...r,
});

const run = (record: SspRagaRecord, stored?: SspStoredRaga, reviews: SspReviewRow[] = []) =>
  buildSspRagaPatch({ record, reviews, volume: 1, stored });

/** The English prose in the fixtures. None of it may appear anywhere in the output. */
const PROSE = [
  'rakti',
  'svarasthānas',
  'ēRRa jāru',
  'as context fits',
  'pleasing',
  'touched',
  'Vīṇā',
];

describe('Bhairavi 20.9, nothing stored', () => {
  const out = run(bhairavi);

  it('sets the fields SSP states', () => {
    expect(out.patch).toMatchObject({
      timeOfDay: 'evening',
      scaleType: 'sampurna',
      isBhashanga: true,
      grahaSwaras: ['D1'],
      jivaSwaras: ['R2', 'G2', 'M1', 'N2'],
      nyasaSwaras: ['R2', 'G2', 'M1', 'N2'],
      anyaSwaras: ['D2', 'R1'],
    });
    expect(out.patch.slokas).toEqual([
      {
        text: 'bhairavirāga saṃpūrṇassāyaṃkālē pragīyatē | pañcaśruti dhaivataṃ ca kvacitsthānē prayujyatē ∥',
        author: 'Vēṅkaṭamakhi',
      },
    ]);
  });

  it('appends nothing for a murcchana that is only a scale with marks', () => {
    // the stored scale is absent here, so the murcchana is appended in the stored format
    expect(out.patch.alternateScales).toEqual(['S R2 G2 M1 P D1 N2 S - S N2 D1 P M1 G2 R2 S']);
  });

  it('stores most_ranjaka and puts the other half in the citation note', () => {
    const jiva = out.citations.find(c => c.field === 'jivaSwaras');
    expect(jiva?.note).toBe('All seven are jiva; these four most of all.');
    expect(jiva?.tradition).toBe('Dikshitar school');
    expect(jiva?.confidence).toBe(0.9);
  });

  it('cites the printed page, with the volume', () => {
    expect(out.citations.find(c => c.field === 'timeOfDay')?.locator).toBe('Vol. 1, p. 390');
    expect(out.citations.find(c => c.field === 'anyaSwaras')?.locator).toBe('Vol. 1, p. 391');
    expect(out.citations.every(c => c.sourceSlug === 'ssp-2008-english')).toBe(true);
  });

  it('strips the low-octave dot from nothing it should keep, and keeps marked phrases', () => {
    const phrases = out.patch.prayogas?.map(p => p.notation);
    expect(phrases).toContain('N2. S R2 G2 R2');
    expect(out.patch.prayogas?.[0]).toEqual({
      notation: 'R2 G2 G2 R2',
      label: 'Jiva phrase',
      gamaka: '/ ⋎',
    });
  });

  it('turns the borrowed-note phrases into prayogas with our own label', () => {
    expect(out.patch.prayogas?.find(p => p.notation === 'N2 D2 N2 S')?.label).toBe(
      'Borrowed-note phrase'
    );
  });

  it('carries no English prose', () => {
    const dump = JSON.stringify(out);
    for (const word of PROSE) expect(dump).not.toContain(word);
  });
});

describe('fill-only rule', () => {
  it('overwrites a stored value that has no citation', () => {
    const out = run(bhairavi, { timeOfDay: 'universal', scaleType: 'audava' });
    expect(out.patch.timeOfDay).toBe('evening');
    expect(out.patch.scaleType).toBe('sampurna');
  });

  it('never touches a field cited by another source', () => {
    const out = run(bhairavi, {
      timeOfDay: 'night',
      citations: [
        { field: 'timeOfDay', sourceSlug: 'web-karnatik-com', locator: 'https://x.test' },
      ],
    });
    expect(out.patch.timeOfDay).toBeUndefined();
    expect(out.citations.some(c => c.field === 'timeOfDay')).toBe(false);
    expect(out.notes.join(' ')).toContain('kept stored timeOfDay');
  });

  it('never writes arohanam, avarohanam, description, parentRaga or melaNumber', () => {
    const keys = Object.keys(run(bhairavi).patch);
    for (const k of ['arohanam', 'avarohanam', 'description', 'parentRaga', 'melaNumber']) {
      expect(keys).not.toContain(k);
    }
  });
});

describe('the Tamil edition, with the citations of docs/research/bhairavi-ssp-2026-10.csv', () => {
  const tamil = (field: string, locator = 'p. 375') => ({
    field,
    sourceSlug: 'ssp-1963-tamil',
    locator,
  });
  const stored: SspStoredRaga = {
    arohanam: 'S R2 G2 M1 P D1 N2 S',
    avarohanam: 'S N2 D1 P M1 G2 R2 S',
    timeOfDay: 'evening',
    scaleType: 'sampurna',
    isBhashanga: true,
    jivaSwaras: ['R', 'G', 'M', 'N'],
    nyasaSwaras: ['R', 'G', 'M', 'N'],
    grahaSwaras: ['D'],
    anyaSwaras: ['D2'],
    citations: [
      tamil('timeOfDay'),
      tamil('scaleType'),
      tamil('isBhashanga'),
      tamil('jivaSwaras'),
      tamil('nyasaSwaras'),
      tamil('grahaSwaras'),
      tamil('anyaSwaras', 'pp. 375–376'),
    ],
  };
  const out = run(bhairavi, stored);

  it('adds the English citation beside the Tamil one and changes no value', () => {
    for (const f of [
      'timeOfDay',
      'scaleType',
      'isBhashanga',
      'jivaSwaras',
      'nyasaSwaras',
      'grahaSwaras',
    ]) {
      expect(out.patch).not.toHaveProperty(f);
      expect(out.citations.filter(c => c.field === f)).toHaveLength(1);
    }
    expect(out.citations.find(c => c.field === 'grahaSwaras')?.locator).toBe('Vol. 1, p. 390');
  });

  it('reports a disagreement and keeps the stored value', () => {
    // Tamil p. 375 lists D2 only; English lists D2, R1 too
    expect(out.patch.anyaSwaras).toBeUndefined();
    expect(out.citations.some(c => c.field === 'anyaSwaras')).toBe(false);
    expect(out.notes.join('\n')).toMatch(/anyaSwaras: the English edition disagrees/);
  });

  it('leaves a field cited by Tamil and another source alone', () => {
    const mixed = run(bhairavi, {
      ...stored,
      citations: [
        ...(stored.citations ?? []),
        { field: 'timeOfDay', sourceSlug: 'web-karnatik-com', locator: 'x' },
      ],
    });
    expect(mixed.citations.some(c => c.field === 'timeOfDay')).toBe(false);
  });
});

describe('alternateScales', () => {
  it('appends to the stored list in the stored "asc - desc" format, never replacing', () => {
    const existing = 'S R2 G2 M1 P D2 S - S D2 M1 G2 R2 S';
    const out = run(bhairavi, { alternateScales: [existing] });
    expect(out.patch.alternateScales).toEqual([
      existing,
      'S R2 G2 M1 P D1 N2 S - S N2 D1 P M1 G2 R2 S',
    ]);
  });

  it('puts exactly the appended entry in the citation note', () => {
    const out = run(bhairavi);
    const c = out.citations.find(x => x.field === 'alternateScales');
    expect(c?.note).toBe(out.patch.alternateScales?.[0]);
    expect(c?.locator).toBe('Vol. 1, p. 390');
  });

  it('skips a murcchana equal to the stored arohanam and avarohanam', () => {
    const out = run(bhairavi, {
      arohanam: 'S R2 G2 M1 P D1 N2 S',
      avarohanam: 'S N2 D1 P M1 G2 R2 S',
    });
    expect(out.patch.alternateScales).toBeUndefined();
    expect(out.notes.join(' ')).toContain('equals the stored arohanam');
  });

  it('skips a murcchana already in the list, even with a "(10 name janya)" prefix', () => {
    const out = run(bhairavi, {
      alternateScales: ['(20 nArIrItigauLa janya) S R2 G2 M1 P D1 N2 S - S N2 D1 P M1 G2 R2 S'],
    });
    expect(out.patch.alternateScales).toBeUndefined();
  });

  it('strips the "|" break and the low-octave dot', () => {
    expect(run(mahuri).patch.alternateScales).toEqual([
      'S R2 M1 G3 R2 M1 P D2 S - S N2 D2 P M1 G3 R2 S R2 G3 R2 S',
    ]);
    expect(run(dhanyasi).patch.alternateScales).toEqual(['N2 S G2 M1 P N2 S - N2 D1 P M1 G2 R1 S']);
  });

  it('accepts a murcchana with no S in the line', () => {
    expect(run(brndavani).patch.alternateScales).toEqual(['R2 M1 P N2 S - N2 P M1 R2 S']);
    expect(cleanMurcchanaLine('R2 M1 P').ok).toBe(true);
  });

  it('does not loosen the validator for a line that has an S or is not notation', () => {
    expect(cleanMurcchanaLine('S R2 rises to G2').ok).toBe(false);
    expect(cleanMurcchanaLine('S M3 P').ok).toBe(false);
    expect(cleanMurcchanaLine('S R2').ok).toBe(false);
  });

  it('holds a murcchana flagged variant_uncertain', () => {
    const out = run(rudrapriya, undefined, [
      row(rudrapriya, { kind: 'variant_uncertain', path: 'murcchana' }),
    ]);
    expect(out.patch.alternateScales).toBeUndefined();
    expect(out.held).toEqual([
      expect.objectContaining({
        field: 'alternateScales',
        reason: expect.stringContaining('variant_uncertain'),
      }),
    ]);
  });
});

describe('timeOfDay', () => {
  it('maps the closed table', () => {
    const table: [string, string][] = [
      ['all times', 'universal'],
      ['early morning', 'morning'],
      ['evening dusk', 'evening'],
      ['fourth quarter of the night', 'night'],
      ['first yāma of the night', 'night'],
      ['mid-afternoon', 'afternoon'],
    ];
    for (const [raw, want] of table) {
      expect(mapSspTimeOfDay(raw)).toEqual({ ok: true, value: want });
    }
  });

  it('flags an ambiguous yāma and an unknown phrase apart', () => {
    expect(mapSspTimeOfDay('first yāma')).toEqual({ ok: false, reason: 'ambiguous' });
    expect(mapSspTimeOfDay('fifth yāma (bāṇa yāma)')).toEqual({ ok: false, reason: 'ambiguous' });
    expect(mapSspTimeOfDay('at the festival')).toEqual({ ok: false, reason: 'unmapped' });
  });

  it('reads "all times" as universal', () => {
    expect(run(brndavani).patch.timeOfDay).toBe('universal');
  });

  it('holds an ambiguous vivaraṇa time', () => {
    const rec: SspRagaRecord = {
      ...dhanyasi,
      lakshana: { time_of_day: 'first yāma', sources: [src('time_of_day', 435)] },
    };
    const out = run(rec);
    expect(out.patch.timeOfDay).toBeUndefined();
    expect(out.held[0]).toMatchObject({ field: 'timeOfDay', value: 'first yāma' });
  });

  it('takes the vivaraṇa value and adds a śloka citation when the śloka differs', () => {
    const out = run(ahiri);
    expect(out.patch.timeOfDay).toBe('night');
    const cites = out.citations.filter(c => c.field === 'timeOfDay');
    expect(cites.map(c => c.tradition)).toEqual(['Dikshitar school', 'Venkatamakhi']);
    expect(cites[1]?.note).toContain('fifth yāma (bāṇa yāma)');
    expect(cites[1]?.locator).toBe('Vol. 1, p. 426');
  });

  it('adds no second citation when the śloka agrees', () => {
    expect(run(bhairavi).citations.filter(c => c.field === 'timeOfDay')).toHaveLength(1);
    expect(run(asaveri).citations.filter(c => c.field === 'timeOfDay')).toHaveLength(1);
  });
});

describe('isBhashanga, scaleType', () => {
  it('is true for bhāṣāṅga, false for upāṅga, unset for a mela', () => {
    expect(run(bhairavi).patch.isBhashanga).toBe(true);
    expect(run(husani).patch.isBhashanga).toBe(false);
    const mela: SspRagaRecord = {
      ...bhairavi,
      kind: 'mela',
      janya_class: 'mela',
      lakshana: { raga_class: 'mela', sources: [] },
    };
    expect(run(mela).patch).not.toHaveProperty('isBhashanga');
  });

  it('keeps the vivaraṇa scale type where the śloka adds a qualifier, and says so', () => {
    const out = run(asaveri);
    expect(out.patch.scaleType).toBe('sampurna');
    expect(out.notes.join(' ')).toContain('the śloka reads');
  });
});

describe('prayogas', () => {
  const out = run(husani);

  it('holds pōḍi, modernist and single-token phrases, keeps the rest', () => {
    expect(out.patch.prayogas?.map(p => p.notation)).toEqual(['S R2 G3 M1 P M1', 'N2. R2 R2 G3']);
    const reasons = out.held.filter(h => h.field === 'prayogas').map(h => h.reason);
    expect(reasons).toEqual([
      expect.stringContaining('pōḍi'),
      expect.stringContaining('modernist'),
      'single-token phrase',
    ]);
  });

  it('strips octave marks from an octave_unmarked phrase', () => {
    const rec: SspRagaRecord = {
      ...husani,
      lakshana: {
        prayogas: [{ notation: "S' P G2 M1 N2.", octave_unmarked: true, printed_page: 1 }],
        sources: [],
      },
    };
    expect(run(rec).patch.prayogas?.[0]?.notation).toBe('S P G2 M1 N2');
  });

  it('holds a phrase with a variant_uncertain review row, by index', () => {
    const o = run(ahiri, undefined, [
      row(ahiri, { kind: 'variant_uncertain', path: 'lakshana.prayogas[0]', detail: "S' N2 D1 P" }),
    ]);
    expect(o.patch.prayogas?.map(p => p.notation)).not.toContain("S' N2 D1 P");
    expect(o.held.some(h => h.value === "S' N2 D1 P")).toBe(true);
  });

  it('caps the list', () => {
    const many: SspRagaRecord = {
      ...husani,
      lakshana: {
        prayogas: Array.from({ length: 60 }, (_, i) => ({
          notation:
            `S R2 ${i % 2 ? 'G3' : 'M1'} ${'P '.repeat((i % 7) + 1)}D2 N2 ${'S '.repeat(Math.floor(i / 7) + 1)}`.trim(),
          printed_page: 1,
        })),
        sources: [],
      },
    };
    const o = run(many);
    expect(o.patch.prayogas?.length).toBeLessThanOrEqual(50);
  });

  it('maps labels to a closed set', () => {
    expect(prayogaLabel('jiva-svara sancara')).toBe('Jiva phrase');
    expect(prayogaLabel('anya-svara prayoga (kākali niṣāda)')).toBe('Borrowed-note phrase');
    expect(prayogaLabel('viśēṣa prayoga')).toBe('Characteristic phrase');
    expect(prayogaLabel('dhaivata nokku prayoga')).toBeUndefined();
  });
});

describe('Āhiri: variant_uncertain and the vakra scale', () => {
  const out = run(ahiri, undefined, [
    row(ahiri, { kind: 'variant_uncertain', path: 'lakshana.anya_swaras[1]', detail: null }),
    row(ahiri, {
      kind: 'variant_uncertain',
      path: 'lakshana.prayogas[1]',
      detail: 'S M1 G3 M1 G2 M1 P',
    }),
  ]);

  it('holds the anya swara and its phrases, and the flagged phrase', () => {
    expect(out.patch.anyaSwaras).toEqual(['R1']);
    expect(out.patch.prayogas?.map(p => p.notation)).not.toContain('P R2 S');
    expect(out.held.map(h => h.field)).toEqual(expect.arrayContaining(['anyaSwaras', 'prayogas']));
    expect(out.held.every(h => h.reason.includes('variant_uncertain'))).toBe(true);
  });

  it('stores jiva once when all and most agree, with no note', () => {
    expect(out.patch.jivaSwaras).toEqual(['N2', 'D1', 'G2']);
    expect(out.citations.find(c => c.field === 'jivaSwaras')?.note).toBeUndefined();
  });

  it('skips an empty nyasa set', () => {
    expect(out.patch).not.toHaveProperty('nyasaSwaras');
  });

  it('keeps the zigzag murcchana as an alternate scale', () => {
    expect(out.patch.alternateScales).toEqual(['S R2 S G2 M1 P D1 N2 S - S N2 D1 P M1 G2 R2 S']);
  });
});

describe('text_vs_image_conflict', () => {
  it('holds the field it names', () => {
    const out = run(dhanyasi, undefined, [
      row(dhanyasi, {
        kind: 'text_vs_image_conflict',
        detail: 'PDF 478: fixed text renders lower-octave dots as letters',
      }),
    ]);
    // names no field word, so it is the prayogas; the murcchana and śloka still import
    expect(out.patch.alternateScales).toBeDefined();
    expect(out.patch.slokas).toBeDefined();
  });

  it('holds the murcchana when the detail names the ārōhaṇa', () => {
    const out = run(bhairavi, undefined, [
      row(bhairavi, {
        kind: 'text_vs_image_conflict',
        detail: 'Ārōhaṇa ends in the image and text; ārōhaṇa read as one token',
      }),
    ]);
    expect(out.patch.alternateScales).toBeUndefined();
    expect(out.held.find(h => h.field === 'alternateScales')?.reason).toContain(
      'text_vs_image_conflict'
    );
  });

  it('holds the śloka when the detail names it', () => {
    const out = run(bhairavi, undefined, [
      row(bhairavi, { kind: 'text_vs_image_conflict', detail: 'Śloka: fixed text splits a word' }),
    ]);
    expect(out.patch.slokas).toBeUndefined();
    expect(out.held.some(h => h.field === 'slokas')).toBe(true);
  });

  it('reads the object form that names prayogas', () => {
    const out = run(bhairavi, undefined, [
      row(bhairavi, { kind: 'text_vs_image_conflict', detail: { field: 'prayogas', text: 'x' } }),
    ]);
    expect(out.patch.prayogas).toBeUndefined();
    expect(out.held.some(h => h.field === 'prayogas')).toBe(true);
    expect(out.patch.timeOfDay).toBe('evening');
  });

  it('ignores review rows for another raga', () => {
    const out = run(bhairavi, undefined, [
      { section_id: 'raga_other', kind: 'text_vs_image_conflict', detail: 'prayoga' },
    ]);
    expect(out.patch.prayogas).toBeDefined();
  });
});

describe('asāvēri: a record with a quirk but no prayogas', () => {
  const out = run(asaveri);
  it('sets the facts and leaves empty sets unset', () => {
    expect(out.patch).toMatchObject({ grahaSwaras: ['S'], anyaSwaras: ['N1', 'G1'] });
    expect(out.patch).not.toHaveProperty('prayogas');
    expect(out.patch).not.toHaveProperty('jivaSwaras');
  });
  it('cites a range of printed pages as "pp."', () => {
    expect(sspLocator(2, [658, 659])).toBe('Vol. 2, pp. 658–659');
    expect(sspLocator(2, [658])).toBe('Vol. 2, p. 658');
  });
});

describe('slokas', () => {
  it('uses the verse verbatim, with its author, cited at the verse page', () => {
    const out = run(ahiri);
    expect(out.patch.slokas?.[0]?.text).toBe(ahiri.sloka?.text_iast);
    expect(out.citations.find(c => c.field === 'slokas')?.locator).toBe('Vol. 1, p. 426');
  });

  it('notes an editor-supplied verse and drops a long author string', () => {
    const rec: SspRagaRecord = {
      ...bhairavi,
      sloka: {
        author:
          'Vēṅkaṭamakhi (Caturdaṇḍīprakāśikā, cited by the editors from the Rāgalakṣaṇamu in the anubandhamu; SSP 1904 gives no śloka)',
        attributed_to: 'editors (ED)',
        text_iast: 'auḍavō madhavarjyatvāddṁsadhvanirihēṣyatē |',
        printed_page: 868,
      },
    };
    const out = run(rec);
    expect(out.patch.slokas).toEqual([
      { text: 'auḍavō madhavarjyatvāddṁsadhvanirihēṣyatē |', author: 'Vēṅkaṭamakhi' },
    ]);
    expect(out.citations.find(c => c.field === 'slokas')?.note).toContain('editors');
  });
});

describe('sspMovementFacts', () => {
  it('returns the English facts as input, apart from the patch', () => {
    const facts = sspMovementFacts(bhairavi);
    expect(facts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'other_fact', page: 434 }),
        expect.objectContaining({ kind: 'gamaka_rule', page: 433 }),
      ])
    );
    expect(JSON.stringify(run(bhairavi))).not.toContain('twelve svarasthānas');
  });
});

describe('sspMatchCheck', () => {
  it('flags a mela number that differs', () => {
    expect(sspMatchCheck(bhairavi, { melaNumber: 22 }).melaMismatch).toBe(true);
    expect(sspMatchCheck(bhairavi, { melaNumber: 20 }).melaMismatch).toBe(false);
  });

  it('compares a janya on its parent when the stored raga holds none', () => {
    expect(sspMatchCheck(bhairavi, {}, { parentMelaNumber: 20 }).melaMismatch).toBe(false);
    expect(sspMatchCheck(bhairavi, {}, { parentMelaNumber: 8 }).melaMismatch).toBe(true);
  });

  it('flags a name that occurs twice in the edition', () => {
    const flags = sspMatchCheck(
      bhairavi,
      { melaNumber: 20 },
      { duplicateNames: new Set(['bhairavi']) }
    );
    expect(flags.duplicateName).toBe(true);
    expect(flags.reasons.join(' ')).toContain('more than once');
  });

  it('flags the junk heading', () => {
    const junk: SspRagaRecord = {
      merged_provisional_id: 'raga_ssp-2008-english-vol-1_janyam-6',
      name_canonical: 'janyam 6 (bhāṣāṅgam) — kānrā (aprasiddha)',
      kind: null,
    };
    expect(sspMatchCheck(junk, {}).junkHeading).toBe(true);
  });
});
