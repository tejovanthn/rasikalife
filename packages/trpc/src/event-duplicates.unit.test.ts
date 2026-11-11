import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  chowdiahFirst,
  chowdiahSecond,
} from '../../core/src/domain/event/__fixtures__/chowdiah-pair';
import { findLikelyDuplicates } from '../../core/src/domain/event/duplicates';

const { findLikelyDuplicateEvents } = vi.hoisted(() => ({ findLikelyDuplicateEvents: vi.fn() }));

vi.mock('@rasika/core', () => ({ Event: { findLikelyDuplicateEvents } }));
vi.mock('@rasika/core/constants', () => ({
  ErrorCode: { EVENT_LIKELY_DUPLICATE: 'EVENT_LIKELY_DUPLICATE' },
  ApplicationError: class extends Error {
    constructor(
      public code: string,
      message: string
    ) {
      super(message);
    }
  },
}));

import { assertNoLikelyDuplicates, likelyDuplicatesOfDrafts } from './event-duplicates';

const draft = { ...chowdiahSecond, status: undefined };

beforeEach(() => {
  // The real rule over a one-row table: only the acknowledgement path is under test.
  findLikelyDuplicateEvents
    .mockReset()
    .mockImplementation(async target => findLikelyDuplicates([chowdiahFirst], target));
});

describe('blocking duplicate check', () => {
  it('refuses a likely duplicate with no acknowledgement', async () => {
    const hits = await likelyDuplicatesOfDrafts([draft]);
    expect(hits[0].duplicates.map(d => d.id)).toEqual([chowdiahFirst.id]);
    expect(() => assertNoLikelyDuplicates(hits)).toThrow(/Likely duplicate/);
  });
  it('lets it through when the caller names the event as different', async () => {
    const hits = await likelyDuplicatesOfDrafts([{ ...draft, notDuplicateOf: [chowdiahFirst.id] }]);
    expect(hits).toEqual([]);
    expect(() => assertNoLikelyDuplicates(hits)).not.toThrow();
  });
  it('lets it through when the answer was stored on the event earlier', async () => {
    const stored = { ...draft, notDuplicateOf: [chowdiahFirst.id] };
    expect(await likelyDuplicatesOfDrafts([stored])).toEqual([]);
  });
  it('does not match another draft in the same batch', async () => {
    findLikelyDuplicateEvents.mockImplementation(async target =>
      findLikelyDuplicates([chowdiahFirst], target)
    );
    const hits = await likelyDuplicatesOfDrafts([draft, { ...draft, id: chowdiahFirst.id }]);
    expect(hits).toEqual([]);
  });
});
