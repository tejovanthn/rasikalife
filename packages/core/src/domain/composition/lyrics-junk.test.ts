import { describe, expect, it } from 'vitest';
import { isNavigationLine, removeLyricsJunk, splitScrapedHeader } from './lyrics-junk';

describe('isNavigationLine', () => {
  it('catches the site links, including respelled ones', () => {
    expect(isNavigationLine('Go Back to Pujopacharam – Swami Thiru Aradhanam')).toBe(true);
    expect(isNavigationLine('FOr mOrE sO~Ngs frOm Narayana ThIrtha, plEasE click hErE')).toBe(true);
    expect(isNavigationLine('nExt sO~Ng – chitha juni kanhayakku jaya ma~Ngalam')).toBe(true);
    expect(isNavigationLine('plEasE sI yOutubE vidEO frOm 4.10 minutE.')).toBe(true);
  });

  it('leaves lyrics and notes to the singer alone', () => {
    expect(isNavigationLine('gOvinda yadhu nandana harE krishna')).toBe(false);
    expect(isNavigationLine('EvEry linE su~Ng twicE (as in tExt bElOw)')).toBe(false);
    expect(isNavigationLine('Some Variations to the above so~Ng (Youtube so~Ng below)')).toBe(
      false
    );
  });
});

describe('splitScrapedHeader', () => {
  it('removes a whole header line', () => {
    expect(splitScrapedHeader('namba bEDi.  rAgA:  pUrvi.  Adi tALA.')).toMatchObject({
      header: 'namba bEDi.  rAgA:  pUrvi.  Adi tALA.',
      rest: '',
    });
    expect(splitScrapedHeader('patita pAvana.  rAgA: tODi.  tALA: Adi')?.rest).toBe('');
    expect(splitScrapedHeader('shrIpatim.  rAgamAlikA.  Adi tALA.')?.rest).toBe('');
    expect(splitScrapedHeader('shikharamAn2a.  no givan2 rAgA or tALA.')?.rest).toBe('');
  });

  it('keeps the pallavi that ran on after the header', () => {
    expect(
      splitScrapedHeader('pa~NkajAkSa tava.  rAgA:  tODi.  rUpaka tALA.  pa~NkajAkSa tava sEvAm')
        ?.rest
    ).toBe('pa~NkajAkSa tava sEvAm');
    expect(
      splitScrapedHeader('sAmajavara.  rAgA: madhyamAvati.  tALA: Adi  sAmajavara gamana')?.rest
    ).toBe('sAmajavara gamana');
    expect(
      splitScrapedHeader('shendil vaLar (kaNNigaL).  rAgA: khamAs.  tALA: tisra Adi')?.rest
    ).toBe('');
  });

  it('drops a trailing composer name only when it is the composer', () => {
    const line = 'tAlO tAlO kaNNE.  rAgA:  hindOLa.  Adi tALA.  Papan2asham Shivan2.';
    expect(splitScrapedHeader(line, 'Papanasam Sivan')?.rest).toBe('');
    expect(splitScrapedHeader(line)?.rest).toBe('');
    expect(
      splitScrapedHeader('nin2 aruL.  rAgA: kAmavardhin2i.  tALA: rUpaka  nin2 aruL iyambalAgumO')
        ?.rest
    ).toBe('nin2 aruL iyambalAgumO');
  });

  it('removes an ashtapadi header', () => {
    expect(
      splitScrapedHeader('ashtapadi -21 (bhagavath saamIpyam) khanta / punnagavaraali / jampa')
    ).toBeDefined();
  });

  it('is not fooled by a ragamalika marker or a section label', () => {
    expect(splitScrapedHeader('(rAgA:  kAmbhOji)')).toBeUndefined();
    expect(splitScrapedHeader('rAgA:  yadukulakAmbhOji')).toBeUndefined();
    expect(splitScrapedHeader('first AvaraNa.  rAgam: mOhanam')).toBeUndefined();
    expect(splitScrapedHeader('1. tisra Eka tALA.')).toBeUndefined();
    expect(
      splitScrapedHeader('caturdasha bhuvana rUpa rAgamAlikAbharaNa dharaNAnta')
    ).toBeUndefined();
  });
});

describe('removeLyricsJunk', () => {
  it('strips navigation and the single header, and reports both', () => {
    const { lyrics, removed } = removeLyricsJunk([
      { order: 1, type: 'pallavi', text: 'namba bEDi.  rAgA:  pUrvi.  Adi tALA.\nnamba bEDi' },
      { order: 2, type: 'caraNam', text: 'harE rAma\nGo back to Pujopacharam' },
    ]);
    expect(lyrics.map(l => l.text)).toEqual(['namba bEDi', 'harE rAma']);
    expect(removed.map(r => r.reason)).toEqual(['header', 'navigation']);
  });

  it('leaves every header in a record holding several songs', () => {
    const text = 'a.  rAgA:  tODi.  Adi tALA.\nla la\nb.  rAgA:  kalyANi.  rUpaka tALA.\nla';
    const result = removeLyricsJunk([{ order: 1, text }]);
    expect(result.lyrics[0]?.text).toBe(text);
    expect(result.headers).toBe(2);
  });

  it('leaves a header naming another song, and says which', () => {
    const text = 'palukavE ba~NgAru cilaka.  rAgamAlkA.  Adi tALA.\nla';
    const result = removeLyricsJunk([{ order: 1, text }], { title: 'paLLikkUDam vaittu' });
    expect(result.lyrics[0]?.text).toBe(text);
    expect(result.otherSong).toBe('palukavE ba~NgAru cilaka');
    const same = removeLyricsJunk(
      [{ order: 1, text: 'parpala.  rAgA: khamAs.  tALA: rUpaka\nla' }],
      {
        title: 'paRpala',
      }
    );
    expect(same.lyrics[0]?.text).toBe('la');
  });

  it('strips an ashtapadi index only when it is a list', () => {
    const index = Array.from({ length: 6 }, (_, i) => `aShTapadI ${i + 1} - x – y`).join('\n');
    expect(removeLyricsJunk([{ order: 1, text: `la\n${index}` }]).lyrics[0]?.text).toBe('la');
    const typed = Array.from({ length: 6 }, (_, i) => `Ashtapadhi ${i + 1}- x – y`).join('\n');
    expect(removeLyricsJunk([{ order: 1, text: `la\n${typed}` }]).lyrics[0]?.text).toBe('la');
    const one = 'aShTapadI 7 - maamiyam – bhupalam\nla';
    expect(removeLyricsJunk([{ order: 1, text: one }]).lyrics[0]?.text).toBe(one);
  });

  it('drops a section left empty', () => {
    const { lyrics } = removeLyricsJunk([
      { order: 1, text: 'la' },
      { order: 2, text: 'For some more Abha~Ngs – click here' },
    ]);
    expect(lyrics).toHaveLength(1);
  });
});
