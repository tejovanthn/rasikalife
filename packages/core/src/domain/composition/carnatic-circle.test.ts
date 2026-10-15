import { describe, expect, it } from 'vitest';
import {
  type WpPage,
  isoToItrans,
  parseSongPage,
  parseTitle,
  readRomanisation,
  selectSongPages,
} from './carnatic-circle';

const SITE = 'https://carnatic-circle.com';

function page(id: number, slugPath: string, title: string, html: string, parent = 0): WpPage {
  return {
    id,
    parent,
    link: `${SITE}/${slugPath}/`,
    title: { rendered: title },
    content: { rendered: html },
  };
}

const LYRICS = '<p>Paahi madhana gopaala mukunda<br>paalitha pari paalitha muchukunda</p>';

describe('selectSongPages', () => {
  it('keeps leaf song pages and drops index pages, tabla, theory and event write-ups', () => {
    const pages = [
      page(1, 'choral-singing-sampradaya-bhajanai', 'Choral', LYRICS),
      page(2, 'choral-singing-sampradaya-bhajanai/paahi', 'Paahi', LYRICS, 1),
      page(3, 'tabla-lessonsnotes/kaidapaltas/kaida-1', 'Kaida 1', LYRICS),
      page(4, 'carnatic-lessonsnotes/music-theory/melakartha', 'Melakartha', LYRICS),
      page(5, '17th-feb-2018-bhajan-at-birmingham-balaji-temple', 'Bhajan', LYRICS),
      page(6, 'slokams-divyanaamam', 'Slokams-divyanaamam', LYRICS),
      page(
        7,
        'chandrashekara-bharati',
        'Chandrashekara',
        '<p>This is a placeholder for songs composed by Chandrashekara Bharati.</p>'
      ),
      page(8, 'vignesham-bhajare', 'Vignesham bhajare', LYRICS),
    ];
    expect(selectSongPages(pages).map(p => p.id)).toEqual([2, 8]);
  });
});

describe('parseTitle', () => {
  it('takes "title – raga – tala" apart', () => {
    expect(parseTitle('mangaLAlaya &#8211; kEdAragowLa &#8211; Adi')).toEqual({
      title: 'mangaLAlaya',
      raga: 'kEdAragowLa',
      tala: 'Adi',
    });
  });

  it('leaves a two-part title whole: the second half may be a composer or a type', () => {
    expect(parseTitle('Daasachi Sampathi &#8211; Samarth Ramdas').title).toBe(
      'Daasachi Sampathi – Samarth Ramdas'
    );
  });
});

describe('readRomanisation', () => {
  it('tells ITRANS, ISO and plain English apart', () => {
    expect(readRomanisation('rAma daya jUDavE BadrAcala rAmA nanu brOvavE')).toBe('itrans');
    expect(readRomanisation('nī pāda darśanamu')).toBe('iso');
    expect(readRomanisation('Paahi Madhana Gopaala Mukunda')).toBe('plain');
  });

  it('converts ISO to ITRANS, reading IAST ṛ and ṃ the IAST way', () => {
    expect(isoToItrans('nī pāda darśanamu')).toBe('nI pAda darshanamu');
    expect(isoToItrans('sukṛta')).toBe('sukRRita');
    // Tamil ṉ is our n2.
    expect(isoToItrans('aiyaṉai')).toBe('aiyan2ai');
  });
});

describe('parseSongPage', () => {
  it('reads the karnatik.com-style header and splits the sections', () => {
    const html = `<p>raagam: neelaambari<br>29 dheera shankaraabharaNam janya<br>
      Aa: S R2 G3 M1 P D2 P N3 S<br>Av: S N3 P M1 G3 R2 G3 S<br>taaLam: aadi<br>
      Composer: OothukkaaDu VenkaTasubbaiyyar</p>
      <p>pallavi<br>maNI nUpura dhAri rAjagOpAla</p>
      <p>anupallavi<br>maNI gOmEtaka lOhi taganIla</p>
      <p>charaNam<br>pAdi madhyama rAtiriyil</p>`;
    const song = parseSongPage(page(1, 'manipura', 'MaNinoopura dhaari', html), []);
    expect(song).toMatchObject({
      title: 'MaNinoopura dhaari',
      raga: 'neelaambari',
      tala: 'aadi',
      composer: 'OothukkaaDu VenkaTasubbaiyyar',
      scale: { arohanam: 'S R2 G3 M1 P D2 P N3 S', avarohanam: 'S N3 P M1 G3 R2 G3 S' },
      romanisation: 'itrans',
    });
    expect(song?.lyrics.map(l => l.type)).toEqual(['pallavi', 'anupallavi', 'charanam']);
    expect(song?.lyrics[0]?.text).toBe('maNI nUpura dhAri rAjagOpAla');
  });

  it('reads "Title Ragam : raga / tala" and keeps the first lyric line that repeats the title', () => {
    const html = `<p>Dhanyoham Krishnaa Ragam : sankarabharanam / chaapu</p>
      <p>Dhanyoham krishnaa krishna dhanyoham<br>thava naama keerthanena dhanyoham</p>`;
    const song = parseSongPage(page(1, 'd', 'Dhanyoham Krishnaa', html), []);
    expect(song).toMatchObject({ raga: 'sankarabharanam', tala: 'chaapu', romanisation: 'plain' });
    expect(song?.lyrics).toEqual([
      {
        type: 'lyrics',
        order: 1,
        text: 'Dhanyoham krishnaa krishna dhanyoham\nthava naama keerthanena dhanyoham',
      },
    ]);
  });

  it('leaves the raga blank when the page names several, and says which', () => {
    const html = `<p>Jaanaki Ramana Ragam : Saaramati / madhyamavati/ sree / Adi</p>
      <p>Jaana ki rama naa kalyaana guna<br>sajjanaa vana nipu naa hare raama</p>`;
    const song = parseSongPage(page(1, 'j', 'Jaanaki Ramana kalyaana guna', html), []);
    expect(song?.raga).toBeUndefined();
    expect(song?.tala).toBe('Adi');
    expect(song?.ragaOptions).toEqual(['Saaramati', 'madhyamavati', 'sree']);
    expect(song?.notes).toContain('ragas: Saaramati / madhyamavati / sree');
  });

  it('starts the lyrics after the song header, leaving a slokam and its meaning out', () => {
    const html = `<p>tvatprasAdam param kAmkshE krushNa nAnyam tukAmAyE</p>
      <p>Oh Krishna, I am yearning for your grace whole-heartedly. Please accept me.</p>
      <p>sAvEri – aTa</p>
      <p>kAnkshEtava prasAdam gOpAlabAla kEvalamEvAham||</p>`;
    const tarangini = page(9, 'narayana-theertha-tarangini', 'Narayana Theertha Tarangini', '');
    const song = parseSongPage(page(1, 'k', 'Kankshe Tava prasadam', html, 9), [tarangini]);
    expect(song).toMatchObject({ raga: 'sAvEri', tala: 'aTa', composer: 'Narayana Tirtha' });
    expect(song?.lyrics.map(l => l.text)).toEqual([
      'kAnkshEtava prasAdam gOpAlabAla kEvalamEvAham||',
    ]);
  });

  it('prefers the composer the page names over its collection', () => {
    const html = `<p>raagam: tilang<br>taaLam: aadi<br>Composer: Sadaashiva Bruhmendrar</p>
      <p>prativaaram vaaram, mAnasa bhajarE raghuveeram</p>`;
    const collection = page(9, 'purandaradasa-krithigalu', 'Purandaradasa Krithigalu', '');
    const song = parseSongPage(page(1, 'b', 'bArayya namma manege', html, 9), [collection]);
    expect(song?.composer).toBe('Sadaashiva Bruhmendrar');
  });

  it('reads several fields on one line, and the "X ragam in Y talam" sentence', () => {
    const fields = parseSongPage(
      page(
        1,
        'g',
        'Guru mAtA guru pitA',
        '<p>Raga: Yaman F || Tala: Ekam || Composer: Eknath Maharaj</p><p>guru mAtA guru pitA guru Apula</p>'
      ),
      []
    );
    expect(fields).toMatchObject({ raga: 'Yaman F', tala: 'Ekam', composer: 'Eknath Maharaj' });

    const sentence = parseSongPage(
      page(
        1,
        'n',
        'nAda Murali',
        '<p>Hameer Kalyani ragam in Adi talam</p><p>P</p><p>nAda murali gAna vilOlA</p>'
      ),
      []
    );
    expect(sentence).toMatchObject({ raga: 'Hameer Kalyani', tala: 'Adi' });
    expect(sentence?.lyrics[0]).toEqual({
      type: 'pallavi',
      order: 1,
      text: 'nAda murali gAna vilOlA',
    });
  });

  it('converts an ISO page to ITRANS, title included', () => {
    const html = '<p>rāgam : malayamāruta tāl̤am : tripuṭa</p><p>Pallavi<br>nī pāda darśanamu</p>';
    const song = parseSongPage(page(1, 'n', 'nī pāda darśanamu', html), []);
    expect(song).toMatchObject({
      title: 'nI pAda darshanamu',
      raga: 'malayamaruta',
      tala: 'triputa',
      romanisation: 'itrans',
    });
    expect(song?.lyrics[0]?.text).toBe('nI pAda darshanamu');
  });

  it('drops swara lines and English notes from the lyrics', () => {
    const html =
      '<p>Pallavi<br>tAkiTTa taritajuNu tAm<br>s r g m p d n s<br>(repeat the line twice and the end)</p>';
    const song = parseSongPage(page(1, 't', 'Tillana', html), []);
    expect(song?.lyrics[0]?.text).toBe('tAkiTTa taritajuNu tAm');
  });

  it('returns null when nothing reads as lyrics', () => {
    expect(parseSongPage(page(1, 'x', 'X', '<p>Ragam: Kalyani</p>'), [])).toBeNull();
  });
});
