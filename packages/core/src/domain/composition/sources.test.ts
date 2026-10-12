import { describe, expect, it } from 'vitest';
import { describeSource, describeSources, mergeSources, sourcesOf } from './sources';

describe('describeSource', () => {
  it('credits karnatik.com as a page', () => {
    expect(describeSource('https://karnatik.com/c0000.shtml')).toMatchObject({
      site: 'karnatik.com',
      kind: 'page',
    });
  });

  it('reads a shivkumar.org PDF or page as notation', () => {
    expect(describeSource('https://www.shivkumar.org/music/adamodi.pdf')).toEqual({
      url: 'https://www.shivkumar.org/music/adamodi.pdf',
      site: 'Shivkumar Kalyanaraman (shivkumar.org)',
      kind: 'notation',
      label: 'Notation (PDF)',
    });
    expect(describeSource('https://www.shivkumar.org/music/adamodi.htm').label).toBe(
      'Notation (HTML)'
    );
  });

  it('names a recording from its file name, and YouTube as video', () => {
    const label = (file: string) => describeSource(`https://www.shivkumar.org/music/${file}`).label;
    expect(describeSource('http://www.shivkumar.org/music/adamodi-detailed.mp3')).toMatchObject({
      kind: 'audio',
      label: 'Detailed lesson (MP3)',
    });
    expect(label('alakalladaga-class.mp4')).toBe('Class recording (MP4)');
    expect(label('AngarakamSurutti_Part2_RK.mp3')).toBe('Recording, part 2 (MP3)');
    expect(label('adamodi.mp3')).toBe('Recording (MP3)');
    expect(describeSource('https://www.youtube.com/watch?v=AMppvfCS6vE')).toMatchObject({
      site: 'YouTube',
      kind: 'video',
    });
  });

  it('falls back to the host name for a site it does not know', () => {
    expect(describeSource('http://guru-guha.blogspot.com/2007/08/x.html').site).toBe(
      'guru-guha.blogspot.com'
    );
  });
});

describe('describeSources', () => {
  it('numbers labels that repeat on one song, and only those', () => {
    const labels = describeSources([
      'https://karnatik.com/c1.shtml',
      'https://www.shivkumar.org/music/adamodi.mp3',
      'https://www.shivkumar.org/music/adamodi-detailed.mp3',
      'https://www.shivkumar.org/music/05a-adamodi-charukesi-krithi-ssi-c01.mp3',
    ]).map(source => source.label);
    expect(labels).toEqual([
      'karnatik.com',
      'Recording (MP3) 1',
      'Detailed lesson (MP3)',
      'Recording (MP3) 2',
    ]);
  });
});

describe('mergeSources', () => {
  it('appends new links and drops repeats that differ only in scheme or www', () => {
    expect(
      mergeSources(
        ['https://karnatik.com/c1.shtml'],
        ['http://www.karnatik.com/c1.shtml', 'https://www.shivkumar.org/music/a.pdf']
      )
    ).toEqual(['https://karnatik.com/c1.shtml', 'https://www.shivkumar.org/music/a.pdf']);
  });
});

describe('sourcesOf', () => {
  it('prefers the list and falls back to the legacy field', () => {
    expect(sourcesOf({ sources: ['a'], sourceAttribution: 'b' })).toEqual(['a']);
    expect(sourcesOf({ sources: [], sourceAttribution: 'b' })).toEqual(['b']);
    expect(sourcesOf({})).toEqual([]);
  });
});
