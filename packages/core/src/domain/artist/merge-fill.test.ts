import { describe, expect, it } from 'vitest';

import { artistMergeFillPatch } from './merge-fill';

describe('artistMergeFillPatch', () => {
  it('takes from the loser only what the survivor lacks', () => {
    const patch = artistMergeFillPatch(
      { city: 'Chennai', website: '', specialisations: [] },
      { city: 'Bengaluru', website: 'https://example.org', specialisations: ['Carnatic vocal'] }
    );

    expect(patch).toEqual({
      website: 'https://example.org',
      specialisations: ['Carnatic vocal'],
    });
  });

  it('never copies isGroup, which would strand membership edges', () => {
    const patch = artistMergeFillPatch({}, { isGroup: true } as Record<string, unknown>);

    expect(patch).toEqual({});
  });

  it('copies nothing from a blank loser', () => {
    expect(artistMergeFillPatch({}, { title: '  ', gurus: [] })).toEqual({});
  });
});

describe('artistMergeFillPatch for historical fields', () => {
  it('fills the new fields and carries their citations', () => {
    const cite = { field: 'mudra', sourceSlug: 'ssp-2008-english', locator: 'p. 14' };
    const patch = artistMergeFillPatch(
      { deathYear: 1835 },
      { deathYear: 1900, mudra: 'guruguha', deathPlace: 'Ettayapuram', citations: [cite] }
    );
    expect(patch).toEqual({
      mudra: 'guruguha',
      deathPlace: 'Ettayapuram',
      citations: [cite],
    });
  });

  it('never copies isHistorical', () => {
    const patch = artistMergeFillPatch({}, { isHistorical: true } as Record<string, unknown>);
    expect(patch).not.toHaveProperty('isHistorical');
  });
});
