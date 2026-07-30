import { describe, expect, it } from 'vitest';
import type { BioExtraction } from './bio-extract';
import { PROPOSAL_COLUMNS, bestArtistMatch, toProposals } from './bio-proposals';
import type { Artist } from './entity';

const artist = { id: 'art_yagnika', name: 'Yagnika Madhusudan Iyengar' };

function candidate(id: string, name: string, alternateNames?: string[]): Artist {
  return { id, name, alternateNames } as Artist;
}

const candidates = [
  candidate('art_radha', 'Radha Shridhar'),
  candidate('art_sneha', 'Sneha Devanandan'),
  candidate('art_padmini', 'Padmini Ravi'),
];

function extraction(overrides: Partial<BioExtraction> = {}): BioExtraction {
  return {
    gurus: [],
    affiliations: [],
    credentials: [],
    works: [],
    arangetram: null,
    unresolved: [],
    ...overrides,
  };
}

describe('bestArtistMatch', () => {
  it('finds an exact match', () => {
    expect(bestArtistMatch('Radha Shridhar', candidates)).toMatchObject({ id: 'art_radha' });
  });

  it('strips honorifics before matching, so "Guru Smt." does not defeat it', () => {
    expect(bestArtistMatch('Guru Smt. Radha Shridhar', candidates)).toMatchObject({
      id: 'art_radha',
    });
  });

  it('considers alternate names', () => {
    const withAlias = [candidate('art_tmk', 'T M Krishna', ['Thodur Madabusi Krishna'])];
    expect(bestArtistMatch('Thodur Madabusi Krishna', withAlias)).toMatchObject({ id: 'art_tmk' });
  });

  it('returns null for a name nothing resembles', () => {
    expect(bestArtistMatch('Completely Different Person', candidates)).toBeNull();
  });

  it('returns null for an empty or honorific-only name', () => {
    expect(bestArtistMatch('   ', candidates)).toBeNull();
    expect(bestArtistMatch('Radha Shridhar', [])).toBeNull();
  });
});

describe('toProposals', () => {
  it('emits one row per guru, carrying the relationship through', () => {
    const rows = toProposals(
      artist,
      extraction({
        gurus: [
          {
            name: 'Sneha Devanandan',
            relationship: 'primary',
            startYear: 1997,
            confidence: 'high',
            sourceSentence: 'She began training under Sneha Devanandan.',
          },
          { name: 'Bragha Bessell', relationship: 'workshop', confidence: 'medium' },
        ],
      }),
      candidates
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      proposalType: 'guru',
      value: 'Sneha Devanandan',
      relationship: 'primary',
      startYear: '1997',
      resolvedId: 'art_sneha',
      confidence: 'high',
    });
    expect(rows[1]).toMatchObject({
      value: 'Bragha Bessell',
      relationship: 'workshop',
      // Nothing in the corpus resembles this name, so the reviewer gets a blank to fill.
      resolvedId: '',
    });
  });

  // Never auto-create. There are already duplicate slugs publicly indexed, and an extractor
  // creating entities at scale multiplies that faster than anyone can clean it up.
  it('leaves organisations unresolved for a human to pick or create', () => {
    const rows = toProposals(
      artist,
      extraction({
        affiliations: [
          {
            organisationName: 'Trayag Natyalaya',
            role: 'founder, artistic director',
            startYear: 2017,
            isCurrent: true,
            confidence: 'high',
          },
        ],
      }),
      candidates
    );

    expect(rows[0]).toMatchObject({
      proposalType: 'affiliation',
      value: 'Trayag Natyalaya',
      role: 'founder, artistic director',
      startYear: '2017',
      relationship: 'current',
      resolvedId: '',
      matchScore: '',
    });
  });

  it('records a credential with its institution in the role column', () => {
    const rows = toProposals(
      artist,
      extraction({
        credentials: [
          {
            qualification: 'MA Bharatanatyam',
            institution: 'SASTRA University',
            confidence: 'high',
          },
        ],
      }),
      candidates
    );

    expect(rows[0]).toMatchObject({
      proposalType: 'credential',
      value: 'MA Bharatanatyam',
      role: 'SASTRA University',
    });
  });

  it('records a work', () => {
    const rows = toProposals(
      artist,
      extraction({ works: [{ title: 'Matrutvam', role: 'director', confidence: 'high' }] }),
      candidates
    );

    expect(rows[0]).toMatchObject({ proposalType: 'work', value: 'Matrutvam', role: 'director' });
  });

  it('resolves the arangetram guru against the corpus', () => {
    const rows = toProposals(
      artist,
      extraction({
        arangetram: {
          year: 2008,
          guruName: 'Radha Shridhar',
          venueName: 'Bharatiya Vidya Bhavan',
          confidence: 'high',
        },
      }),
      candidates
    );

    expect(rows[0]).toMatchObject({
      proposalType: 'arangetram',
      value: 'Radha Shridhar',
      role: 'Bharatiya Vidya Bhavan',
      startYear: '2008',
      resolvedId: 'art_radha',
    });
  });

  it('drops an arangetram that names neither a year nor a guru', () => {
    const rows = toProposals(
      artist,
      extraction({ arangetram: { venueName: 'Somewhere', confidence: 'low' } }),
      candidates
    );

    expect(rows).toEqual([]);
  });

  // The most useful part of the output: the sentences the extractor deliberately refused to
  // convert are exactly where the real judgment calls sit.
  it('carries unresolved items through with their reason', () => {
    const rows = toProposals(
      artist,
      extraction({
        unresolved: [
          {
            text: 'influenced by the teachings of Tirumalai Krishnamacharya',
            reason: 'influence, not direct instruction',
          },
        ],
      }),
      candidates
    );

    expect(rows[0]).toMatchObject({
      proposalType: 'unresolved',
      value: 'influenced by the teachings of Tirumalai Krishnamacharya',
      role: 'influence, not direct instruction',
    });
  });

  it('puts unresolved rows last so a reviewer reads the judgment calls together', () => {
    const rows = toProposals(
      artist,
      extraction({
        gurus: [{ name: 'Radha Shridhar', relationship: 'advanced', confidence: 'high' }],
        unresolved: [{ text: 'something', reason: 'unclear' }],
        works: [{ title: 'Matrutvam', confidence: 'high' }],
      }),
      candidates
    );

    expect(rows.map(r => r.proposalType)).toEqual(['guru', 'work', 'unresolved']);
  });

  it('leaves the decision and correctedValue columns blank for the reviewer', () => {
    const rows = toProposals(
      artist,
      extraction({ works: [{ title: 'Matrutvam', confidence: 'high' }] }),
      candidates
    );

    expect(rows[0].decision).toBe('');
    expect(rows[0].correctedValue).toBe('');
  });

  it('emits every declared column on every row, so the CSV never ragged-edges', () => {
    const rows = toProposals(
      artist,
      extraction({
        gurus: [{ name: 'Radha Shridhar', relationship: 'advanced', confidence: 'high' }],
        unresolved: [{ text: 'something', reason: 'unclear' }],
      }),
      candidates
    );

    for (const row of rows) {
      for (const column of PROPOSAL_COLUMNS) {
        expect(row[column]).toBeDefined();
      }
    }
  });
});
