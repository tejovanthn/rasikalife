import { describe, expect, it } from 'vitest';
import { collectFound } from './collect-found';

describe('collectFound', () => {
  it('drops null and undefined and keeps order', () => {
    expect(collectFound([{ id: 'a' }, null, { id: 'b' }, undefined])).toEqual([
      { id: 'a' },
      { id: 'b' },
    ]);
  });

  it('returns an empty list when nothing was found', () => {
    expect(collectFound([null])).toEqual([]);
  });
});
