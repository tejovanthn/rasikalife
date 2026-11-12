import { describe, expect, it } from 'vitest';
import { mergeOwnerCast } from './cast';

const stored = [
  { id: 'a1', name: 'Asha Rao', role: 'main', title: 'Vid.' },
  { name: 'Ravi', role: 'accompanist' },
];
const make = async (name: string) => ({ name });

describe('mergeOwnerCast', () => {
  it('writes nothing when the names are the ones already stored', async () => {
    expect(
      await mergeOwnerCast(stored, [{ name: 'asha  rao' }, { name: 'Ravi' }], make)
    ).toBeNull();
  });

  it('keeps stored entries whole, adds new names, drops only removed ones', async () => {
    const result = await mergeOwnerCast(stored, [{ name: 'Asha Rao' }, { name: 'New One' }], make);
    expect(result).toEqual([
      { id: 'a1', name: 'Asha Rao', role: 'main', title: 'Vid.' },
      { name: 'New One' },
    ]);
  });

  it('an emptied field removes the cast the owner removed', async () => {
    expect(await mergeOwnerCast(stored, [], make)).toEqual([]);
  });

  it('nothing stored and nothing typed is no change', async () => {
    expect(await mergeOwnerCast([], [], make)).toBeNull();
  });
});
