import { describe, expect, it } from 'vitest';
import { fromItrans } from '../../utils/transliteration';
import {
  applyWordFixes,
  canonicalLanguage,
  checkRespelling,
  cleanCompositionTitle,
  englishLineKind,
  fixTamilRRi,
  isEnglishLine,
  isSwaraLine,
  looksTamil,
  normalizeLyrics,
  normalizeLyricsText,
  restoreProtectedLines,
  retargetTamil,
} from './lyrics-normalize';

const TAMIL_LINE =
  'enna tavam sheidanai yasOdA engum nirai parabhrammam ammAvai azhaikka uLLam pugazh';

describe('normalizeLyricsText', () => {
  it('reads a bare r between consonants as vocalic ṛ', () => {
    expect(fromItrans(normalizeLyricsText('hrdaya krpA'), 'devanagari')).toBe('हृदय कृपा');
    expect(normalizeLyricsText('rSi')).toBe('R^iSi');
  });

  it('keeps real r-clusters', () => {
    for (const word of ['dAridrya', 'tryambaka', 'shrI', 'prapUjitam', 'brahma']) {
      expect(normalizeLyricsText(word)).toBe(word);
    }
  });

  it('leaves swara notation alone', () => {
    expect(normalizeLyricsText('snsr rpg')).toBe('snsr rpg');
  });

  it('turns a nasal before a velar or palatal into ṅ or ñ', () => {
    expect(
      fromItrans(normalizeLyricsText('mangaLam prapanca', { tamil: false }), 'devanagari')
    ).toBe('मङ्गळम् प्रपञ्च');
  });

  it('gives Sanskrit the long e and o it always has', () => {
    expect(normalizeLyricsText('dheera namo', { language: 'Sanskrit' })).toBe('dhIra namO');
    expect(normalizeLyricsText('vaidEhi', { language: 'Sanskrit' })).toBe('vaidEhi');
  });

  it('keeps the short e of a Dravidian language', () => {
    expect(normalizeLyricsText('nenu', { language: 'Telugu' })).toBe('nenu');
  });

  it('writes Tamil ன everywhere except word-initially and before த', () => {
    const out = normalizeLyricsText('ennai bhuvanangaL nAn indran', { tamil: true });
    expect(fromItrans(out, 'tamil')).toBe('என்னை புவனங்கள் நான் இந்த்ரன்');
  });

  it('decides Tamil from the text when not told', () => {
    expect(normalizeLyricsText(TAMIL_LINE)).toContain('en2n2a');
    expect(normalizeLyricsText('endarO mahAnubhAvulu andariki vandanamulu')).toContain(
      'vandanamulu'
    );
  });

  it('writes ज्ञ as j~n, and keeps it out of the Tamil ன rule', () => {
    expect(fromItrans(normalizeLyricsText('jnAna', { tamil: false }), 'devanagari')).toBe('ज्ञान');
    expect(normalizeLyricsText('jnAnam', { tamil: true })).toBe('j~nAn2am');
  });

  it('is idempotent', () => {
    const once = normalizeLyricsText(TAMIL_LINE);
    expect(normalizeLyricsText(once, { tamil: true })).toBe(once);
    const skt = normalizeLyricsText('hrdaya mangaLa dheera', { language: 'Sanskrit' });
    expect(normalizeLyricsText(skt, { language: 'Sanskrit' })).toBe(skt);
  });
});

describe('looksTamil', () => {
  it('ignores the label and reads the text', () => {
    expect(looksTamil(TAMIL_LINE)).toBe(true);
    expect(looksTamil('ADinaTTE yADarAdu harini pADarAdu')).toBe(false);
    expect(looksTamil('vAtApi gaNapatim bhajEham vAraNAsyam')).toBe(false);
  });
});

describe('normalizeLyrics', () => {
  it('decides Tamil once for the whole composition', () => {
    const out = normalizeLyrics(
      [
        { type: 'pallavi', order: 1, text: TAMIL_LINE },
        { type: 'caraNam', order: 2, text: 'manadil' },
      ],
      'Tamil'
    );
    expect(out[1]?.text).toBe('man2adil');
  });

  it('keeps every other field', () => {
    const [out] = normalizeLyrics([{ type: 'pallavi', order: 1, text: 'krpa', ragaName: 'x' }]);
    expect(out).toEqual({ type: 'pallavi', order: 1, text: 'kR^ipa', ragaName: 'x' });
  });
});

describe('checkRespelling', () => {
  it('accepts a respelling', () => {
    expect(checkRespelling('enna tavam sheidanai', 'en2n2a tavam seydan2ai').ok).toBe(true);
    expect(checkRespelling('caraNAm bhOja', 'caraNAmbhOja').ok).toBe(true);
    expect(checkRespelling('uralil porAmai', 'uralil poRAmai').ok).toBe(true);
  });

  it('accepts the looser spellings the corpus also holds', () => {
    expect(checkRespelling('moolaa dhaara moortee', 'mUlAdhAra mUrti').ok).toBe(true);
    expect(checkRespelling('gowri sheivAi', 'gauri sheyvAy').ok).toBe(true);
    expect(checkRespelling('nyaana yagjna', 'j~nAn2a yaj~na').ok).toBe(true);
    expect(checkRespelling('adaip-paTri', 'adaip-paR_Ri').ok).toBe(true);
    expect(checkRespelling('kapla taru', 'kalpa taru').ok).toBe(true);
  });

  it('refuses a changed word', () => {
    expect(checkRespelling('vAtApi gaNapatim bhajEham', 'vAtApi gaNapatim namAmi').ok).toBe(false);
  });

  it('refuses a changed line count', () => {
    expect(checkRespelling('a\nb', 'a b').ok).toBe(false);
  });

  it('refuses any change to a swara line', () => {
    const swaras = 'ga ga pa ga ri sa ri ri ga ri sa';
    expect(checkRespelling(swaras, 'gA gA pa ga ri sa ri ri ga ri sa').ok).toBe(false);
    expect(checkRespelling(swaras, swaras).ok).toBe(true);
  });

  it('accepts what the rules themselves produce', () => {
    const before = 'hrdaya mangaLam ennai bhuvanangaL';
    expect(checkRespelling(before, normalizeLyricsText(before, { tamil: true })).ok).toBe(true);
  });
});

describe('English lines', () => {
  const english = 'When you feel hungry and tired, the only way out of it is the chanting';

  it('are found, without catching Hindi', () => {
    expect(isEnglishLine(english)).toBe(true);
    expect(isEnglishLine('(repeat line starting with tAhata dInuta in the anupallavi)')).toBe(true);
    expect(isEnglishLine('ab tO jaisE hI banI AyI ab tO aisE hI banI AyI')).toBe(false);
    expect(isEnglishLine('nAhi.n amIrI mE.n man lAgyo mErO yAr fakIrI mE.n')).toBe(false);
  });

  it('tell a note to the singer from a translation', () => {
    expect(englishLineKind('(repeat line starting with tAhata dInuta in the anupallavi)')).toBe(
      'note'
    );
    expect(englishLineKind('(Note: caps indicates 2 aksharas)')).toBe('note');
    expect(englishLineKind(english)).toBe('meaning');
  });

  it('are left alone by the rules', () => {
    expect(normalizeLyricsText(`krpa\n${english}`)).toBe(`kR^ipa\n${english}`);
  });

  it('are put back when an older rule set changed them', () => {
    const damaged = english.replace('hungry', 'hu~Ngry');
    expect(restoreProtectedLines(`krpa\n${english}`, `kR^ipa\n${damaged}`)).toBe(
      `kR^ipa\n${english}`
    );
  });
});

describe('isSwaraLine', () => {
  it('tells notation from words', () => {
    expect(isSwaraLine('S R2 G3 M1 P D2 N3 S')).toBe(true);
    expect(isSwaraLine('ga ga pa ga ri sa *ni pa *ni sa ri sA ; ;')).toBe(true);
    expect(isSwaraLine('sa ri ga ma pa da ni sa enna tavam sheidanai yasOdA engum')).toBe(false);
  });
});

describe('canonicalLanguage', () => {
  it('folds the stored variants', () => {
    expect(canonicalLanguage('KannaDa')).toBe('Kannada');
    expect(canonicalLanguage('MalayaaLam')).toBe('Malayalam');
    expect(canonicalLanguage('Sankrit')).toBe('Sanskrit');
    expect(canonicalLanguage('Tamil\n\npallavi')).toBe('Tamil');
    expect(canonicalLanguage('maNipravALam')).toBe('Manipravalam');
    expect(canonicalLanguage('none')).toBeUndefined();
  });
});

describe('cleanCompositionTitle', () => {
  it('drops the scraped link text', () => {
    expect(
      cleanCompositionTitle('endarO mahaanubhaavu - Click to listen (Shivkumar Kalyanaraman)!')
    ).toBe('endarO mahaanubhaavu');
    expect(cleanCompositionTitle('x - Click to lisetn (y)!')).toBe('x');
    expect(cleanCompositionTitle('x - Click to listen (y)! Also Kanyakumari')).toBe('x');
    expect(cleanCompositionTitle('x - Click to listen!')).toBe('x');
  });

  it('keeps the qualifier that tells two pieces apart', () => {
    expect(cleanCompositionTitle('ninnE kOri (varNa)')).toBe('ninnE kOri (varNa)');
    expect(cleanCompositionTitle('saa saa ni (jatiswaram) - Click to listen (P)!')).toBe(
      'saa saa ni (jatiswaram)'
    );
  });

  it('tidies whitespace', () => {
    expect(cleanCompositionTitle('  enna   tavam ')).toBe('enna tavam');
  });
});

describe('applyWordFixes', () => {
  it('replaces whole words, every occurrence', () => {
    const { text } = applyWordFixes('en2ru sol en2ru', [{ from: 'en2ru', to: 'en2Ru' }]);
    expect(text).toBe('en2Ru sol en2Ru');
  });

  it('does not report a fix listed twice', () => {
    const fixes = [
      { from: 'en2ru', to: 'en2Ru' },
      { from: 'en2ru', to: 'en2Ru' },
    ];
    expect(applyWordFixes('en2ru sol', fixes).unmatched).toHaveLength(0);
  });

  it('never reaches inside a word', () => {
    const { text, unmatched } = applyWordFixes('man2adil', [{ from: 'n2', to: 'n' }]);
    expect(text).toBe('man2adil');
    expect(unmatched).toHaveLength(1);
  });

  it('can join two words', () => {
    expect(
      applyWordFixes('caraNAm bhOja', [{ from: 'caraNAm bhOja', to: 'caraNAmbhOja' }]).text
    ).toBe('caraNAmbhOja');
  });

  it('keeps line breaks', () => {
    expect(applyWordFixes('a vAi\nvAi b', [{ from: 'vAi', to: 'vAy' }]).text).toBe('a vAy\nvAy b');
  });
});

describe('fixTamilRRi', () => {
  it('keeps ற்றி from reading as ṛ', () => {
    expect(fixTamilRRi('paRRi veRRilai maRRa')).toBe('paR_Ri veR_Rilai maRRa');
    expect(fromItrans(fixTamilRRi('paRRi'), 'tamil')).toBe('பற்றி');
  });
});

describe('applyWordFixes at punctuation', () => {
  it('treats an attached comma as a boundary, but not ITRANS dot', () => {
    expect(applyWordFixes('pOi, vA', [{ from: 'pOi', to: 'pOy' }]).text).toBe('pOy, vA');
    expect(applyWordFixes('mE.n', [{ from: 'mE', to: 'mI' }]).text).toBe('mE.n');
    expect(applyWordFixes('varap-pOi nI', [{ from: 'pOi', to: 'pOy' }]).text).toBe('varap-pOy nI');
  });
});

describe('retargetTamil', () => {
  it('removes ன from a piece that turned out not to be Tamil', () => {
    expect(retargetTamil('ADinaTTE yADarAdu harin2i', false)).toBe('ADinaTTE yADarAdu harini');
  });

  it('adds it to one that turned out to be', () => {
    expect(retargetTamil('ennai', true)).toBe('en2n2ai');
  });
});
