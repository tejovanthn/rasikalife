import { describe, expect, it } from 'vitest';
import {
  htmlToText,
  lessonArohanam,
  looksLikeSwaras,
  parseHeading,
  parseShivkumarIndex,
  parseShivkumarLesson,
} from './shivkumar';

const KRITHI_INDEX = 'https://www.shivkumar.org/music/index.html';
const VARNAM_INDEX = 'https://www.shivkumar.org/music/varnams/index.html';

describe('parseHeading', () => {
  it('reads "Title: Raga; Tala; Composer; Learnt From …"', () => {
    expect(
      parseHeading(
        'Abhayambikaya: Kedaragowla ; Khanda Chapu; Dikshitar ; Learnt From Recording of: Hyderabad Brothers'
      )
    ).toEqual({
      title: 'Abhayambikaya',
      compositionType: 'kriti',
      raga: 'Kedaragowla',
      tala: 'Khanda Chapu',
      composer: 'Dikshitar',
    });
  });

  it('reads a type tag and drops a bracketed aside, even an unclosed one', () => {
    expect(
      parseHeading(
        'Chalamela (ATA TALA VARNAM) : Shankarabharanam ; Ata Talam: Swati Tirunal; (Notation courtesy: Apoorva'
      )
    ).toMatchObject({
      title: 'Chalamela',
      compositionType: 'varnam',
      raga: 'Shankarabharanam',
      tala: 'Ata',
      composer: 'Swati Tirunal',
    });
  });

  it('reads a semicolon used in place of the colon', () => {
    expect(
      parseHeading('Meru Samaana; Mayamalavagowlai ; Adi (2 kalai); Tyagaraja; Learnt From: X')
    ).toMatchObject({ title: 'Meru Samaana', raga: 'Mayamalavagowlai', tala: 'Adi' });
  });

  it('reads a raga written as the title’s last word', () => {
    expect(
      parseHeading('Tharuni Ninnu Kambodhi ; Adi Talam: Violin Ponnuswamy', 'varnam')
    ).toMatchObject({
      title: 'Tharuni Ninnu',
      compositionType: 'varnam',
      raga: 'Kambodhi',
      composer: 'Violin Ponnuswamy',
    });
  });

  it('cuts "Learnt From" glued to the composer with a full stop', () => {
    expect(
      parseHeading('Ninnu Vina: Thodi; Adi; Dikshitar. Learnt From Recording of: X')?.composer
    ).toBe('Dikshitar');
  });

  it('refuses a heading that names no tala', () => {
    expect(parseHeading('Vishnu Sahasranamam; Version: M.S. Subbalakshmi')).toBeNull();
  });
});

describe('parseShivkumarIndex', () => {
  it('reads an entry with its notation, recordings and video, as absolute URLs', () => {
    const html = `<ul>
      <li> <b> Ada Modi: <a href="./manodharma/index.html#charukesi"> Charukesi </a>; Adi; Tyagaraja ; Learnt From Recording of: Semmangudi</b> <BR>
      <a href="./adamodi.htm"> Notation (HTML </a> | <a href="./adamodi.doc"> MS Word </a> | <a href="./adamodi.pdf"> PDF) </a> |
      <a href="./adamodi.mp3"> MP3 </a> | <a href="https://www.youtube.com/watch?v=x"> YouTube </a>
    </ul>`;
    expect(parseShivkumarIndex(html, KRITHI_INDEX)).toEqual([
      {
        title: 'Ada Modi',
        compositionType: 'kriti',
        raga: 'Charukesi',
        tala: 'Adi',
        composer: 'Tyagaraja',
        htmlUrl: 'https://www.shivkumar.org/music/adamodi.htm',
        pdfUrl: 'https://www.shivkumar.org/music/adamodi.pdf',
        audioUrls: ['https://www.shivkumar.org/music/adamodi.mp3'],
        videoUrls: ['https://www.youtube.com/watch?v=x'],
      },
    ]);
  });

  it('takes the heading, not the bold class link, on the varnam page', () => {
    const html = `<ul><li> Evvari Bodhana (VARNAM): Abhogi ; Adi; Patnam Subramania Iyer
      Notation (<a href="../varnams/evvaribodhana.htm">HTML</a> | <a href="../varnams/evvaribodhana.pdf">PDF</a>) |
      <b><a href="../varnams/evvari.mp3">MUSIC CLASS, LESSON</a></b></ul>`;
    const [entry] = parseShivkumarIndex(html, VARNAM_INDEX);
    expect(entry).toMatchObject({
      title: 'Evvari Bodhana',
      compositionType: 'varnam',
      raga: 'Abhogi',
      pdfUrl: 'https://www.shivkumar.org/music/varnams/evvaribodhana.pdf',
    });
  });

  it('keeps one entry for a lesson the index lists twice', () => {
    const item = `<li><b>Vanga Kadal: Surutti; Adi; Andal</b> <a href="./vanga.pdf">PDF</a>`;
    expect(parseShivkumarIndex(`<ul>${item}${item}</ul>`, KRITHI_INDEX)).toHaveLength(1);
  });

  it('skips drills and links to other sites', () => {
    const html = `<ul>
      <li> SARALI VARISAI (and preliminaries) Notation {(<a href="../basics/sarali-varisai.htm">HTML</a>)}
      <li> Rani's Karnatik.com: Lessons <a href="http://www.geocities.com/x.html">here</a>
    </ul>`;
    expect(parseShivkumarIndex(html, VARNAM_INDEX)).toEqual([]);
  });
});

const LESSON = `                                               Ada Modi

Ragam: Charukesi (26th Melakartha)
         ARO: S R2 G3 M1 P D1 N2 S          ||
         AVA: S N2 D1 P M1 G3 R2 S          ||
Talam: Adi
Composer: Tyagaraja
Details: http://thyagaraja-vaibhavam.blogspot.in/2007/11/aada-modi.html
Lyrics Courtesy: www.sangeetham.com
MP3 Class / Lesson: http://www.shivkumar.org/music/adamodi-detailed.mp3

Pallavi:
Adamodi Galade Ramayya Maata

Anupallavi:
Thodunida Nive Yanuchu Bhaktito
Gudina Nee Paadamu Battina Naato Maata

caraNam 1
Chaduvulanni Delisi Shankaraantshu Dai

Meaning:
O Ramayya! You seem to feel too proud.

Pallavi:
Adamodi Galade Ramayya Maata

P;      D- P  ;M          GR       | G- gr S – R       G,–m           P M      ||
A       da mo - di        Gala       de Ra- - may      yya Maa        - ta
`;

describe('parseShivkumarLesson', () => {
  const lesson = parseShivkumarLesson(LESSON);

  it('reads the header and the URLs its credit lines name', () => {
    expect(lesson.header.Ragam).toBe('Charukesi (26th Melakartha)');
    expect(lesson.header.Composer).toBe('Tyagaraja');
    expect(lessonArohanam(lesson)).toBe('S R2 G3 M1 P D1 N2 S');
    expect(lesson.creditUrls).toEqual([
      'http://thyagaraja-vaibhavam.blogspot.in/2007/11/aada-modi.html',
      'https://www.sangeetham.com',
      'http://www.shivkumar.org/music/adamodi-detailed.mp3',
    ]);
  });

  it('takes the first lyrics block and stops at the meaning', () => {
    expect(lesson.lyrics).toEqual([
      { type: 'pallavi', order: 1, text: 'Adamodi Galade Ramayya Maata' },
      {
        type: 'anupallavi',
        order: 2,
        text: 'Thodunida Nive Yanuchu Bhaktito\nGudina Nee Paadamu Battina Naato Maata',
      },
      { type: 'charanam', order: 3, text: 'Chaduvulanni Delisi Shankaraantshu Dai' },
    ]);
  });

  it('keeps the body from the first heading on, swara columns intact', () => {
    expect(lesson.body.startsWith('Pallavi:')).toBe(true);
    expect(lesson.body).toContain(
      'P;      D- P  ;M          GR       | G- gr S – R       G,–m           P M      ||'
    );
    expect(lesson.body).not.toContain('Ragam:');
  });
});

describe('parseShivkumarLesson without section headings', () => {
  const pasuram = `Aazhi Mazhai Kanna
Ragam: Varali (39th Mela Janyam)
ARO: S R1 G2 M2 P D1 N3 S ||
AVA: S N3 D1 P M2 G2 R1 S ||
Talam: Adi
Composer: Andal
Lyrics / Meaning Courtesy: www.sangeetham.com

aazhi mazhaik kaNNaa onRu nee kai karavEl
aazhi uL pukku mugandhu kodu aarththu ERi

Meaning:
O Lord of rain!

S R G M ||
aa zhi ma zhai
`;
  const lesson = parseShivkumarLesson(pasuram);

  it('starts the body after the header block', () => {
    expect(lesson.body.startsWith('aazhi mazhaik kaNNaa')).toBe(true);
    expect(lesson.body).toContain('S R G M ||');
  });

  it('reads the verse as one lyrics section', () => {
    expect(lesson.lyrics).toEqual([
      {
        type: 'lyrics',
        order: 1,
        text: 'aazhi mazhaik kaNNaa onRu nee kai karavEl\naazhi uL pukku mugandhu kodu aarththu ERi',
      },
    ]);
  });
});

describe('parseShivkumarLesson with a verse heading', () => {
  it('reads a geetham’s Sahityam and a pasuram’s Paasuram as lyrics', () => {
    const geetham = parseShivkumarLesson(
      'VARAVEENA\nRagam: Mohanam\nTalam: Rupakam\n\nSahityam:\nVaraveena Mrudu Paani\nSuruchira Bambhara Veni\n\nMeaning: You hold the veena.\n'
    );
    expect(geetham.lyrics).toEqual([
      { type: 'lyrics', order: 1, text: 'Varaveena Mrudu Paani\nSuruchira Bambhara Veni' },
    ]);
    expect(geetham.body.startsWith('Sahityam:')).toBe(true);

    const pasuram = parseShivkumarLesson(
      'Aazhi Mazhai Kanna\nRagam: Varali\nLyrics / Meaning Courtesy: https://ramanuja.org/x.html\n\nPaasuram (Stanza)\naazhi mazhaik kaNNaa! *\n\nMeaning Courtesy: https://ramanuja.org/x.html\n'
    );
    expect(pasuram.lyrics).toEqual([{ type: 'lyrics', order: 1, text: 'aazhi mazhaik kaNNaa! *' }]);
  });
});

describe('looksLikeSwaras', () => {
  it('tells a notation line from a lyric line', () => {
    expect(looksLikeSwaras('S S rsnd P - pn dp mg rr G || R- S , ndp- ns rg ; R ||')).toBe(true);
    expect(looksLikeSwaras('Abha yaam- bi kaa- - ya- - - ha: - An - yam')).toBe(false);
  });
});

describe('htmlToText', () => {
  it('drops markup and Word’s style blocks, keeping line breaks', () => {
    expect(
      htmlToText(
        '<html><head><style>p{}</style></head><body><p>Pallavi</p><p>Adamodi&nbsp;Galade</p></body></html>'
      )
    ).toBe('Pallavi\nAdamodi Galade');
  });
});
