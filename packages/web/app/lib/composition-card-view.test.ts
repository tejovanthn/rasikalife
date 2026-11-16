import { describe, expect, it } from 'vitest';
import { compositionCardView } from './composition-card-view';

const base = {
  id: 'c1',
  title: 'bAlasubramaNyam',
  ragas: [{ id: 'r1', name: 'kAmbhOji' }],
  talas: [{ id: 't1', name: 'Adi' }],
};

describe('compositionCardView', () => {
  it('transliterates title, raga and tala names', () => {
    const v = compositionCardView(base, 'roman');
    expect(v.title).not.toBe(base.title);
    expect(v.title).toMatch(/^Balasubramanyam/);
    expect(v.ragas?.[0].name).toMatch(/^Kambhoji$/);
    expect(v.talas?.[0].name).toBe('Adi');
  });

  it('keeps the stored title for the link and leaves the input alone', () => {
    const v = compositionCardView(base, 'devanagari');
    expect(v.linkTitle).toBe('bAlasubramaNyam');
    expect(base.title).toBe('bAlasubramaNyam');
    expect(v.title).toMatch(/[ऀ-ॿ]/);
  });

  it('handles missing ragas and talas', () => {
    const v = compositionCardView({ id: 'c2', title: 'x' }, 'roman');
    expect(v.ragas).toBeUndefined();
    expect(v.talas).toBeUndefined();
  });
});
