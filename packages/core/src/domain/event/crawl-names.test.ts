import { describe, expect, it } from 'vitest';
import {
  artistKey,
  clusterArtistNames,
  compareArtistNames,
  jaroWinkler,
  levenshtein,
  pickDisplayName,
} from './crawl-names';

describe('artistKey', () => {
  it('drops titles, initials, dots and spacing, and keeps an initials signal', () => {
    const k = artistKey('Dr. S. Sunder');
    expect(k.key).toBe('sunder');
    expect(k.initials).toEqual(['s']);
    expect(k.hasInitials).toBe(true);
    expect(artistKey('V.Deepika')).toMatchObject({ key: 'deepika', initials: ['v'] });
    expect(artistKey('Smt. Sudha Raghunathan').key).toBe('sudha raghunathan');
    expect(artistKey('U. Ve. Velukkudi Krishnan').key).toBe('velukkudi krishnan');
    expect(artistKey('TM Krishna')).toMatchObject({ key: 'krishna', initials: ['t', 'm'] });
  });

  it('folds common transliteration variants', () => {
    expect(artistKey('Nandhika').folded).toBe(artistKey('Nandika').folded);
    expect(artistKey('Shakthi').folded).toBe(artistKey('Sakti').folded);
    expect(artistKey('Vaidyanathan').folded).toBe(artistKey('Vaidyanatan').folded);
  });

  it('keeps a name that is only initials comparable', () => {
    expect(artistKey('Dr').key).toBe('dr');
  });
});

describe('distance', () => {
  it('measures', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
    expect(jaroWinkler('martha', 'marhta')).toBeGreaterThan(0.95);
  });
});

describe('compareArtistNames', () => {
  it('matches an initial that one side leaves out', () => {
    expect(compareArtistNames('Delhi Sunder Rajan', 'Delhi P. Sunder Rajan').tier).toBe('exact');
    expect(compareArtistNames('Delhi P.Sunderrajan', 'Delhi P. Sunder Rajan').tier).toBe('exact');
    expect(compareArtistNames('Dr. Sudha Raghunathan', 'Sudha Raghunathan').tier).toBe('exact');
  });

  it('accepts a given-name spelling variant but holds a family-name one', () => {
    expect(compareArtistNames('Thyagaraja Rao', 'Tyagaraja Rao').tier).toBe('exact');
    expect(compareArtistNames('Shakthi Muralidharan', 'Shakthi Muralidaran').tier).toBe('close');
  });

  it('holds a one-letter slip for review', () => {
    expect(compareArtistNames('Dr Badri Naraynan', 'Badri Narayanan').tier).toBe('close');
  });

  it('never calls a bare given name the same person as a full name', () => {
    expect(compareArtistNames('Deepika', 'Deepika Varadarajan').tier).not.toBe('exact');
    expect(compareArtistNames('Deepika', 'V. Deepika').tier).toBe('close');
  });

  it('treats different initials as different people', () => {
    expect(compareArtistNames('K. Deepika', 'V. Deepika').tier).toBe('none');
    expect(compareArtistNames('N Ravikiran', 'S Ravikiran').tier).toBe('none');
  });

  it('does not match unrelated names', () => {
    expect(compareArtistNames('Sunil Gargyan', 'Delhi Sunder Rajan').tier).toBe('none');
  });
});

describe('clusterArtistNames', () => {
  it('collapses variants of one person and shows the fullest spelling', () => {
    const { clusters, displayOf } = clusterArtistNames([
      'Delhi Sunder Rajan',
      'Delhi P. Sunder Rajan',
      'Delhi P.Sunderrajan',
      'Sunil Gargyan',
    ]);
    expect(clusters).toHaveLength(2);
    expect(displayOf.get('Delhi Sunder Rajan')).toBe('Delhi P. Sunder Rajan');
    expect(displayOf.get('Delhi P.Sunderrajan')).toBe('Delhi P. Sunder Rajan');
  });

  it('joins a bare given name to the only initialled person who has it', () => {
    const { displayOf } = clusterArtistNames(['Deepika', 'V. Deepika']);
    expect(displayOf.get('Deepika')).toBe('V. Deepika');
  });

  it('does not guess when two initialled people share the given name', () => {
    const { clusters, close } = clusterArtistNames(['Deepika', 'V. Deepika', 'K. Deepika']);
    expect(clusters).toHaveLength(3);
    expect(close.some(c => c.a === 'Deepika')).toBe(true);
  });

  it('keeps two people with one given name apart', () => {
    const { clusters } = clusterArtistNames(['Deepika', 'Deepika Varadarajan']);
    expect(clusters).toHaveLength(2);
  });

  it('lists close pairs without merging them', () => {
    const { clusters, close } = clusterArtistNames(['Shakthi Muralidharan', 'Shakthi Muralidaran']);
    expect(clusters).toHaveLength(2);
    expect(close).toHaveLength(1);
  });

  it('prefers initials, then no title, for display', () => {
    expect(pickDisplayName(['Deepika', 'V. Deepika'])).toBe('V. Deepika');
    expect(pickDisplayName(['Dr. Badri Narayanan', 'Badri Narayanan'])).toBe('Badri Narayanan');
  });
});

describe('titles written in capitals', () => {
  it('reads DR. as a title, not as two initials', () => {
    expect(artistKey('DR. Nithyasree Mahadevan')).toMatchObject({
      key: 'nithyasree mahadevan',
      initials: [],
    });
    expect(pickDisplayName(['DR. Nithyasree Mahadevan', 'Nithyasree Mahadevan'])).toBe(
      'Nithyasree Mahadevan'
    );
    expect(pickDisplayName(['SANDEEP NARAYAN', 'Sandeep Narayan'])).toBe('Sandeep Narayan');
  });
});
