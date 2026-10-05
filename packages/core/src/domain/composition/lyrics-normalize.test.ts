import { describe, expect, it } from 'vitest';
import { fromItrans } from '../../utils/transliteration';
import {
  canonicalLanguage,
  checkRespelling,
  isSwaraLine,
  looksTamil,
  normalizeLyrics,
  normalizeLyricsText,
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
