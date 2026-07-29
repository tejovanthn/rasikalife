import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Artist } from './entity';

vi.mock('.', () => ({
  getArtistByName: vi.fn(),
  createArtist: vi.fn(),
  listArtists: vi.fn(),
}));

import { createArtist, getArtistByName, listArtists } from '.';
import {
  artistNameSimilarity,
  findArtistMatch,
  findOrCreateArtist,
  initialsMatch,
  normalizeArtistName,
  rankArtistSearchResults,
} from './dedup';

function makeArtist(overrides: Partial<Artist>): Artist {
  return {
    id: 'artist-1',
    name: 'Test Artist',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as Artist;
}

describe('normalizeArtistName', () => {
  it('lowercases, trims and collapses whitespace', () => {
    expect(normalizeArtistName('  T   M   Krishna  ')).toBe('t m krishna');
  });

  it('strips periods and commas', () => {
    expect(normalizeArtistName('T.M. Krishna')).toBe('t m krishna');
    expect(normalizeArtistName('Krishna, T M')).toBe('krishna t m');
  });

  it('strips a leading honorific', () => {
    expect(normalizeArtistName('Sri T M Krishna')).toBe('t m krishna');
    expect(normalizeArtistName('Dr Krishna')).toBe('krishna');
  });

  it('strips stacked leading honorifics, case-insensitively', () => {
    expect(normalizeArtistName('Dr Smt X')).toBe('x');
    expect(normalizeArtistName('SRI DR VIDWAN Krishna')).toBe('krishna');
  });

  it('recognizes every documented honorific', () => {
    const honorifics = [
      'Sri',
      'Shri',
      'Sree',
      'Smt',
      'Smt.',
      'Srimati',
      'Dr',
      'Prof',
      'Vidwan',
      'Vidushi',
      'Kum',
      'Kumari',
      'Master',
      'Guru',
      'Pandit',
      'Ustad',
      'Thiru',
      'Selvi',
    ];
    for (const honorific of honorifics) {
      expect(normalizeArtistName(`${honorific} Krishna`)).toBe('krishna');
    }
  });

  it('does not strip a honorific-like word that is the entire name', () => {
    expect(normalizeArtistName('Guru')).toBe('guru');
  });

  it('only strips honorifics from the front, not mid-name', () => {
    expect(normalizeArtistName('Krishna Guru')).toBe('krishna guru');
  });

  it('returns empty string for empty or whitespace-only input', () => {
    expect(normalizeArtistName('')).toBe('');
    expect(normalizeArtistName('   ')).toBe('');
    expect(normalizeArtistName('.,')).toBe('');
  });
});

describe('initialsMatch', () => {
  it('matches an abbreviated given name against the expanded form', () => {
    expect(initialsMatch('T M Krishna', 'Thodur Madabusi Krishna')).toBe(true);
  });

  it('matches in both directions', () => {
    expect(initialsMatch('Thodur Madabusi Krishna', 'T M Krishna')).toBe(true);
  });

  it('matches through honorifics and punctuation', () => {
    expect(initialsMatch('Sri T.M. Krishna', 'Thodur Madabusi Krishna')).toBe(true);
  });

  it('does not match when the surname differs (the "Krishnan" near-miss)', () => {
    expect(initialsMatch('T M Krishna', 'T M Krishnan')).toBe(false);
  });

  it('does not match when an initial disagrees with the expanded token', () => {
    expect(initialsMatch('T M Krishna', 'Thodur Ganesh Krishna')).toBe(false);
  });

  it('does not match when token counts differ', () => {
    expect(initialsMatch('T Krishna', 'Thodur Madabusi Krishna')).toBe(false);
  });

  it('does not match single-token names', () => {
    expect(initialsMatch('Krishna', 'Krishna')).toBe(false);
  });

  it('does not match empty input', () => {
    expect(initialsMatch('', 'Thodur Madabusi Krishna')).toBe(false);
    expect(initialsMatch('T M Krishna', '')).toBe(false);
  });
});

describe('artistNameSimilarity', () => {
  it('returns 1 for exact normalized equality', () => {
    expect(artistNameSimilarity('T M Krishna', 'T M Krishna')).toBe(1);
    expect(artistNameSimilarity('Sri T M Krishna', 'T M Krishna')).toBe(1);
  });

  it('boosts an initials match to at least 0.9', () => {
    const score = artistNameSimilarity('T M Krishna', 'Thodur Madabusi Krishna');
    expect(score).toBeGreaterThanOrEqual(0.9);
  });

  it('returns a low score for unrelated names', () => {
    const score = artistNameSimilarity('T M Krishna', 'Zubin Mehta');
    expect(score).toBeLessThan(0.5);
  });

  it('caps the "Krishnan" near-miss below the default threshold', () => {
    // Raw edit distance scores this 0.92 because the names differ by one
    // character. The differing surname caps it instead, so it can never
    // auto-match.
    expect(artistNameSimilarity('T M Krishna', 'T M Krishnan')).toBeLessThan(0.85);
    expect(initialsMatch('T M Krishna', 'T M Krishnan')).toBe(false);
  });

  it('caps a differing initial well below a differing surname', () => {
    // "N Ravikiran" vs "S Ravikiran" scores 0.91 on raw edit distance despite
    // being different people. The initial disagreement is categorical, so it
    // is penalized harder than a surname difference.
    const differingInitial = artistNameSimilarity('N Ravikiran', 'S Ravikiran');
    const differingSurname = artistNameSimilarity('T M Krishna', 'T M Krishnan');
    expect(differingInitial).toBeLessThan(differingSurname);
    expect(differingInitial).toBeLessThan(0.85);
  });

  it('returns 0 when either input is empty or whitespace-only', () => {
    expect(artistNameSimilarity('', 'T M Krishna')).toBe(0);
    expect(artistNameSimilarity('T M Krishna', '   ')).toBe(0);
    expect(artistNameSimilarity('', '')).toBe(0);
  });
});

describe('findArtistMatch', () => {
  it('matches on the candidate name', () => {
    const candidates = [makeArtist({ id: 'a1', name: 'T M Krishna' })];
    const match = findArtistMatch('Sri T M Krishna', candidates);
    expect(match?.id).toBe('a1');
  });

  it('matches on alternateNames', () => {
    const candidates = [
      makeArtist({ id: 'a1', name: 'Thodur Madabusi Krishna', alternateNames: ['TM Krishna'] }),
    ];
    const match = findArtistMatch('T M Krishna', candidates);
    expect(match?.id).toBe('a1');
  });

  it('returns null when no candidate is above the threshold', () => {
    const candidates = [makeArtist({ id: 'a1', name: 'Zubin Mehta' })];
    expect(findArtistMatch('T M Krishna', candidates)).toBeNull();
  });

  it('does not match the "Krishnan" near-miss at the default threshold', () => {
    const candidates = [makeArtist({ id: 'a1', name: 'T M Krishnan' })];
    expect(findArtistMatch('T M Krishna', candidates)).toBeNull();
  });

  it('returns null for empty candidate list', () => {
    expect(findArtistMatch('T M Krishna', [])).toBeNull();
  });

  it('returns null for empty or whitespace-only input regardless of candidates', () => {
    const candidates = [makeArtist({ id: 'a1', name: 'T M Krishna' })];
    expect(findArtistMatch('', candidates)).toBeNull();
    expect(findArtistMatch('   ', candidates)).toBeNull();
  });

  it('respects a custom threshold: stricter threshold rejects a borderline match', () => {
    const candidates = [makeArtist({ id: 'a1', name: 'T M Krishna' })];
    const score = artistNameSimilarity('T M Krishnamurthy', 'T M Krishna');
    // Sanity: the near-miss should score below 1 but not necessarily below the
    // default threshold — pin the test to a threshold just above its score.
    expect(findArtistMatch('T M Krishnamurthy', candidates, score + 0.01)).toBeNull();
    expect(findArtistMatch('T M Krishnamurthy', candidates, score - 0.01)).not.toBeNull();
  });

  it('picks the best-scoring candidate when several are above threshold', () => {
    const candidates = [
      makeArtist({ id: 'a1', name: 'T M Krishnamurthy' }),
      makeArtist({ id: 'a2', name: 'T M Krishna' }),
    ];
    const match = findArtistMatch('T M Krishna', candidates, 0.5);
    expect(match?.id).toBe('a2');
  });
});

describe('findOrCreateArtist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the exact match without creating or paging candidates', async () => {
    const existing = makeArtist({ id: 'a1', name: 'T M Krishna' });
    vi.mocked(getArtistByName).mockResolvedValue(existing);

    const result = await findOrCreateArtist('T M Krishna');

    expect(result).toEqual({ artist: existing, created: false });
    expect(listArtists).not.toHaveBeenCalled();
    expect(createArtist).not.toHaveBeenCalled();
  });

  it('falls back to a fuzzy match when there is no exact hit', async () => {
    vi.mocked(getArtistByName).mockResolvedValue(null);
    const fuzzy = makeArtist({ id: 'a2', name: 'Thodur Madabusi Krishna' });
    vi.mocked(listArtists).mockResolvedValue({
      items: [fuzzy],
      nextToken: undefined,
      hasMore: false,
    });

    const result = await findOrCreateArtist('T M Krishna');

    expect(result.created).toBe(false);
    expect(result.artist.id).toBe('a2');
    expect(result.artist.name).toBe('Thodur Madabusi Krishna');
    expect(createArtist).not.toHaveBeenCalled();
  });

  it('pages through listArtists to build the candidate set', async () => {
    vi.mocked(getArtistByName).mockResolvedValue(null);
    const fuzzy = makeArtist({ id: 'a2', name: 'Thodur Madabusi Krishna' });
    vi.mocked(listArtists)
      .mockResolvedValueOnce({ items: [], nextToken: 'page2', hasMore: true })
      .mockResolvedValueOnce({ items: [fuzzy], nextToken: undefined, hasMore: false });

    const result = await findOrCreateArtist('T M Krishna');

    expect(listArtists).toHaveBeenCalledTimes(2);
    expect(result.artist.id).toBe('a2');
  });

  it('creates a new artist when nothing matches', async () => {
    vi.mocked(getArtistByName).mockResolvedValue(null);
    vi.mocked(listArtists).mockResolvedValue({ items: [], nextToken: undefined, hasMore: false });
    const created = makeArtist({ id: 'new-1', name: 'Brand New Artist' });
    vi.mocked(createArtist).mockResolvedValue(created);

    const result = await findOrCreateArtist('Brand New Artist');

    expect(createArtist).toHaveBeenCalledWith({
      name: 'Brand New Artist',
      title: undefined,
      gurus: [],
    });
    expect(result).toEqual({ artist: created, created: true });
  });

  it('passes title through when creating', async () => {
    vi.mocked(getArtistByName).mockResolvedValue(null);
    vi.mocked(listArtists).mockResolvedValue({ items: [], nextToken: undefined, hasMore: false });

    await findOrCreateArtist('Brand New Artist', { title: 'Vidwan' });

    expect(createArtist).toHaveBeenCalledWith({
      name: 'Brand New Artist',
      title: 'Vidwan',
      gurus: [],
    });
  });

  it('does not overwrite the title of a matched record', async () => {
    const existing = { id: 'artist-1', name: 'T M Krishna' } as Artist;
    vi.mocked(getArtistByName).mockResolvedValue(existing);

    const result = await findOrCreateArtist('T M Krishna', { title: 'Vidwan' });

    expect(createArtist).not.toHaveBeenCalled();
    expect(result).toEqual({ artist: existing, created: false });
  });

  it('applies a custom threshold to the fuzzy match step', async () => {
    vi.mocked(getArtistByName).mockResolvedValue(null);
    const near = makeArtist({ id: 'a3', name: 'T M Krishnamurthy' });
    vi.mocked(listArtists).mockResolvedValue({
      items: [near],
      nextToken: undefined,
      hasMore: false,
    });
    vi.mocked(createArtist).mockResolvedValue(makeArtist({ id: 'new-2', name: 'T M Krishna' }));

    const strict = await findOrCreateArtist('T M Krishna', { threshold: 0.99 });
    expect(strict.created).toBe(true);
    expect(createArtist).toHaveBeenCalledTimes(1);
  });
});

// Real Carnatic name pairs that edit distance alone scores dangerously high.
// A false positive here silently fuses two artists, so every pair below must
// stay under the default threshold. Pairs marked "same person" are accepted
// false negatives: they leave a duplicate, which mergeArtist can fix.
describe('near-miss pairs never auto-match', () => {
  const differentPeople: [string, string][] = [
    ['T M Krishna', 'T M Krishnan'],
    ['Thodur Madabusi Krishna', 'Thodur Madabusi Krishnan'],
    ['N Ravikiran', 'S Ravikiran'],
    ['T N Seshagopalan', 'T V Seshagopalan'],
    ['Ranjani Gopalakrishnan', 'Gayatri Gopalakrishnan'],
    ['A Kanyakumari', 'A Kanyakumar'],
    ['Aruna Sairam', 'Aruna Sairaman'],
    ['R Vedavalli', 'R Vedavalli Ammal'],
    ['Neyveli Santhanagopalan', 'Neyveli Santhanagopal'],
    ['Krishna', 'Krishnan'],
    ['Umayalpuram K Sivaraman', 'Umayalpuram K Sivakumar'],
    // Differ only in a given-name token, with a long shared surname. Scored
    // across the whole string these reach 0.90-0.96, because the surname
    // drowns out the difference.
    ['Sriram Parthasarathy', 'Sriran Parthasarathy'],
    ['Sanjeev Balasubramaniam', 'Sanjeeb Balasubramaniam'],
    ['Malladi Sreeram Prasad', 'Malladi Sriram Prasad'],
    ['Vijay Siva', 'Vijai Siva'],
    // Same person in reality; rejecting costs a duplicate, which is the
    // cheaper error. Listed here so the trade-off stays visible.
    ['Sudha Raghunathan', 'Sudha Ragunathan'],
    ['Sanjay Subrahmanyan', 'Sanjay Subrahmanyam'],
  ];

  for (const [a, b] of differentPeople) {
    it(`rejects "${a}" vs "${b}"`, () => {
      const candidates = [makeArtist({ id: 'a1', name: b })];
      expect(findArtistMatch(a, candidates)).toBeNull();
    });
  }
});

describe('genuine variants still match', () => {
  const samePerson: [string, string][] = [
    ['Sri T M Krishna', 'T M Krishna'],
    ['Dr Smt Aruna Sairam', 'Aruna Sairam'],
    ['T.M. Krishna', 'T M Krishna'],
    ['T M Krishna', 'Thodur Madabusi Krishna'],
    ['TM Krishna', 'T M Krishna'],
  ];

  for (const [a, b] of samePerson) {
    it(`matches "${a}" vs "${b}"`, () => {
      const candidates = [makeArtist({ id: 'a1', name: b })];
      expect(findArtistMatch(a, candidates)?.id).toBe('a1');
    });
  }
});

// The moderator picker used artistNameSimilarity alone, which answers a different question:
// "are these two complete names the same person". Every unrelated name came back at exactly
// the differing-surname cap, so they tied and the dropdown filled with arbitrary rows, and a
// partial query ranked the name it prefixes *below* that noise.
describe('rankArtistSearchResults', () => {
  const candidates = [
    { name: 'Sneha Devandan' },
    { name: 'Omkarnath Havaldar' },
    { name: 'Madan' },
    { name: 'Embar S Kannan' },
  ];

  it('drops names that merely share letters with the query', () => {
    expect(rankArtistSearchResults('Sneha Devandan', candidates).map(c => c.name)).toEqual([
      'Sneha Devandan',
    ]);
  });

  it('matches while the name is still being typed', () => {
    expect(rankArtistSearchResults('Sneha', candidates).map(c => c.name)).toEqual([
      'Sneha Devandan',
    ]);
    expect(rankArtistSearchResults('Sne', candidates).map(c => c.name)).toEqual(['Sneha Devandan']);
  });

  it('matches on a later word, not only the start', () => {
    expect(rankArtistSearchResults('devandan', candidates).map(c => c.name)).toEqual([
      'Sneha Devandan',
    ]);
  });

  it('ranks a prefix above a mid-name match', () => {
    const ranked = rankArtistSearchResults('kannan', [
      { name: 'Embar S Kannan' },
      { name: 'Kannan Balakrishnan' },
    ]);
    expect(ranked.map(c => c.name)).toEqual(['Kannan Balakrishnan', 'Embar S Kannan']);
  });

  it('still tolerates a spelling variant of a complete name', () => {
    const ranked = rankArtistSearchResults('T M Krishna', [{ name: 'T M Krishnaa' }]);
    expect(ranked.map(c => c.name)).toEqual(['T M Krishnaa']);
  });

  it('searches alternate names too', () => {
    const ranked = rankArtistSearchResults('Bombay', [
      { name: 'Jayashri Ramnath', alternateNames: ['Bombay Jayashri'] },
    ]);
    expect(ranked).toHaveLength(1);
  });

  it('returns nothing for an empty query rather than everything', () => {
    expect(rankArtistSearchResults('   ', candidates)).toEqual([]);
  });
});
