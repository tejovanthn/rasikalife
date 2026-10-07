import { describe, expect, it } from 'vitest';
import { formatSwaras, fromItrans, transliterate } from './transliteration';

describe('transliterate', () => {
  it('converts ITRANS to IAST', () => {
    expect(transliterate('bhairavI', 'itrans', 'iast')).toBe('bhairavī');
  });

  it('converts ITRANS to Devanagari', () => {
    expect(transliterate('bhairavI', 'itrans', 'devanagari')).toBe('भैरवी');
  });

  it('is identity when from === to', () => {
    expect(transliterate('bhairavI', 'iast', 'iast')).toBe('bhairavI');
  });

  it('handles empty string', () => {
    expect(transliterate('', 'itrans', 'iast')).toBe('');
  });

  it('reads the Dravidian long vowels E and O', () => {
    // Plain `itrans` leaves these untouched, producing `husEni` on the page. IAST
    // has no long ē/ō of its own, so they land as plain `e`/`o` — the point is that
    // the capital is consumed as a vowel rather than surviving into the display name.
    expect(transliterate('husEni', 'itrans', 'iast')).toBe('huseni');
    expect(transliterate('vEgavAhini', 'itrans', 'iast')).toBe('vegavāhini');
  });
});

describe('Telugu and Kannada anusvara', () => {
  it('writes a nasal before a stop or sibilant as the anusvara', () => {
    expect(fromItrans('endarO vandanamu', 'kannada')).toBe('ಎಂದರೋ ವಂದನಮು');
    expect(fromItrans('endarO vandanamu', 'telugu')).toBe('ఎందరో వందనము');
    expect(fromItrans('sa~ncAramu neri~Ngi samsAra', 'kannada')).toBe('ಸಂಚಾರಮು ನೆರಿಂಗಿ ಸಂಸಾರ');
  });

  it('keeps the conjunct before a nasal, y, r, l or v', () => {
    expect(fromItrans('anna janma kanya sammati', 'kannada')).toBe('ಅನ್ನ ಜನ್ಮ ಕನ್ಯ ಸಮ್ಮತಿ');
    expect(fromItrans('anna janma kanya sammati', 'telugu')).toBe('అన్న జన్మ కన్య సమ్మతి');
  });

  it('joins a word split by a hyphen, but not one that ends a line', () => {
    expect(fromItrans('mahAnubhAvu-landariki', 'kannada')).toBe('ಮಹಾನುಭಾವುಲಂದರಿಕಿ');
    expect(fromItrans('tEDit-tEDi', 'tamil')).toBe('தேடித்தேடி');
    expect(fromItrans('hR^idayAra-\nvinda', 'kannada')).toBe('ಹೃದಯಾರ-\nವಿಂದ');
    expect(fromItrans('mahAnubhAvu-landariki')).toBe('mahanubhavu-landariki');
  });

  it('leaves Devanagari and Tamil as they were', () => {
    expect(fromItrans('vandanamu', 'devanagari')).toBe('वन्दनमु');
  });
});

describe('Tamil ன in other scripts', () => {
  it('is plain n where the script has no letter for it', () => {
    expect(fromItrans('en2n2a', 'telugu')).toBe('ఎన్న');
    expect(fromItrans('en2n2a', 'kannada')).toBe('ಎನ್ನ');
  });

  it('keeps its own letter where there is one', () => {
    expect(fromItrans('en2n2a', 'tamil')).toBe('என்ன');
    expect(fromItrans('en2n2a', 'devanagari')).toBe('ऎऩ्ऩ');
    expect(fromItrans('en2n2a')).toBe('enna');
  });
});

describe('Tamil output', () => {
  it('prints vocalic ṛ without the apostrophe sanscript marks it with', () => {
    expect(fromItrans('hR^idaya', 'tamil')).toBe('ஹ்ருதய');
  });

  it('writes ñj as ஞ்ச, the cluster Tamil uses', () => {
    expect(fromItrans('ne~njam', 'tamil')).toBe('நெஞ்சம்');
  });

  it('writes ற்றி through the `_` separator, which never reaches the page', () => {
    expect(fromItrans('muR_Rilum', 'tamil')).toBe('முற்றிலும்');
    expect(fromItrans('muR_Rilum', 'devanagari')).toBe('मुऱ्ऱिलुम्');
    expect(fromItrans('muR_Rilum')).toBe('murrilum');
  });

  it('leaves a word-initial ஜ alone', () => {
    expect(fromItrans('jaya', 'tamil')).toBe('ஜய');
  });
});

describe('fromItrans', () => {
  it('defaults to roman so anonymous visitors and crawlers get everyday spelling', () => {
    expect(fromItrans('bhairavI')).toBe('bhairavi');
    expect(fromItrans('kalyANi')).toBe('kalyani');
    expect(fromItrans('darbAri kAnaDa')).toBe('darbari kanada');
  });

  it('strips the mid-word capitals that made names look like broken data', () => {
    expect(fromItrans('husEni')).toBe('huseni');
    expect(fromItrans('vEgavAhini')).toBe('vegavahini');
  });

  it('still converts to IAST when asked', () => {
    expect(fromItrans('bhairavI', 'iast')).toBe('bhairavī');
    expect(fromItrans('tyAgarAja', 'iast')).toBe('tyāgarāja');
  });

  it('converts to Devanagari when specified', () => {
    expect(fromItrans('bhairavI', 'devanagari')).toBe('भैरवी');
  });

  it('handles empty string', () => {
    expect(fromItrans('')).toBe('');
  });
});

describe('formatSwaras', () => {
  it('leaves standard notation alone', () => {
    expect(formatSwaras('S R2 G2 M1 P D1 N2 S')).toBe('S R2 G2 M1 P D1 N2 S');
  });

  it('uppercases swara letters but keeps the variant digits', () => {
    expect(formatSwaras('s r2 g2 m1 p d1 n2 s')).toBe('S R2 G2 M1 P D1 N2 S');
  });

  it('collapses stray whitespace', () => {
    expect(formatSwaras('  S   R2  G3 M1 ')).toBe('S R2 G3 M1');
  });

  it('never transliterates — the letters collide with ITRANS consonants', () => {
    // `fromItrans` would turn this into `ṣ ṟ2 ġ2 ṃ1 P ḍ1 ṇ2 ṣ`.
    expect(formatSwaras('S R2 G2 M1 P D1 N2 S')).not.toMatch(/[̀-̣̱ͯ]/);
  });

  it('handles empty string', () => {
    expect(formatSwaras('')).toBe('');
  });
});
