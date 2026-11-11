import { describe, expect, it } from 'vitest';
import { artistEventsMeta, compositionMeta } from './composition-meta';

describe('compositionMeta', () => {
  const base = { title: 'Bhagavan Saranam', composer: 'Tyagaraja', language: 'Telugu' };

  it('says Lyrics, composer and raga when lyrics are stored', () => {
    const { title } = compositionMeta({ ...base, raga: 'Kamas', hasLyrics: true });
    expect(title).toBe('Bhagavan Saranam Lyrics – Tyagaraja | Kamas Raga');
  });

  it('claims no lyrics or meaning when the record has none', () => {
    const m = compositionMeta({ ...base, raga: 'Kamas', hasLyrics: false });
    expect(m.title).not.toContain('Lyrics');
    expect(m.description).not.toMatch(/lyrics|meaning/i);
  });

  it('names the language and scripts, and meaning only when stored', () => {
    const no = compositionMeta({ ...base, hasLyrics: true });
    expect(no.description).toContain(
      'Telugu lyrics in Roman, Devanagari, Tamil, Telugu or Kannada script'
    );
    expect(no.description).not.toContain('meaning');
    const yes = compositionMeta({ ...base, hasLyrics: true, hasMeaning: true });
    expect(yes.description).toContain('with meaning');
  });

  it('keeps the title near 60 characters and keeps the composer', () => {
    const { title } = compositionMeta({
      title: 'Sri Mahaganapatim Manasa Smarami Vaaranavadana',
      composer: 'Muthuswami Dikshitar',
      raga: 'Gaula',
      tala: 'Adi',
      hasLyrics: true,
    });
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title).toContain('Muthuswami Dikshitar');
  });

  it('keeps the description within 155 characters', () => {
    const { description } = compositionMeta({
      ...base,
      title: 'A'.repeat(80),
      raga: 'Kharaharapriya',
      tala: 'Adi',
      hasLyrics: true,
      hasMeaning: true,
    });
    expect(description.length).toBeLessThanOrEqual(155);
  });
});

describe('artistEventsMeta', () => {
  it('names upcoming concerts, the artist and the year of the next event', () => {
    const m = artistEventsMeta({
      name: 'Vinay Varanasi',
      upcomingDates: ['2026-12-20T10:00:00Z', '2026-11-30T10:00:00Z'],
    });
    expect(m.title).toBe('Vinay Varanasi Upcoming Concerts 2026 | Rasika.life');
    expect(m.description).toContain('2 upcoming concerts');
  });

  it('does not claim upcoming concerts when there are none', () => {
    const m = artistEventsMeta({ name: 'Vinay Varanasi', upcomingDates: [] });
    expect(m.title).not.toContain('Upcoming');
  });

  it('drops the brand for a long name', () => {
    const m = artistEventsMeta({
      name: 'A Very Long Artist Name Indeed Here',
      upcomingDates: ['2026-12-01'],
    });
    expect(m.title.length).toBeLessThanOrEqual(60);
  });
});
