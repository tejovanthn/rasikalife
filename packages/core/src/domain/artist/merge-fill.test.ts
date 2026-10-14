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
