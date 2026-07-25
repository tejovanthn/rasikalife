import { describe, expect, it } from 'vitest';
import { computeRepertoire } from './repertoire';

describe('computeRepertoire', () => {
  const row = (over: Partial<Parameters<typeof computeRepertoire>[0][number]>) => ({
    compositionId: 'c1',
    compositionTitle: 'Vatapi',
    ragaId: 'r1',
    ragaName: 'Hamsadhwani',
    ...over,
  });

  it('counts compositions and ragas across rows and ranks by count', () => {
    const result = computeRepertoire([
      row({ compositionId: 'c1', ragaId: 'r1' }),
      row({ compositionId: 'c1', ragaId: 'r1' }),
      row({ compositionId: 'c2', compositionTitle: 'Endaro', ragaId: 'r2', ragaName: 'Sri' }),
    ]);

    expect(result.topCompositions).toEqual([
      { id: 'c1', title: 'Vatapi', count: 2 },
      { id: 'c2', title: 'Endaro', count: 1 },
    ]);
    expect(result.topRagas).toEqual([
      { id: 'r1', name: 'Hamsadhwani', count: 2 },
      { id: 'r2', name: 'Sri', count: 1 },
    ]);
  });

  it('ignores rows with no composition or raga id', () => {
    const result = computeRepertoire([
      row({ compositionId: undefined, ragaId: undefined }),
      row({ compositionId: 'c1', ragaId: undefined }),
    ]);

    expect(result.topCompositions).toEqual([{ id: 'c1', title: 'Vatapi', count: 1 }]);
    expect(result.topRagas).toEqual([]);
  });

  it('falls back to the id when a name is missing', () => {
    const result = computeRepertoire([{ compositionId: 'c9', ragaId: 'r9' }]);

    expect(result.topCompositions[0]).toEqual({ id: 'c9', title: 'c9', count: 1 });
    expect(result.topRagas[0]).toEqual({ id: 'r9', name: 'r9', count: 1 });
  });

  it('caps each list at ten entries', () => {
    const rows = Array.from({ length: 15 }, (_, i) =>
      row({ compositionId: `c${i}`, ragaId: `r${i}` })
    );
    const result = computeRepertoire(rows);

    expect(result.topCompositions).toHaveLength(10);
    expect(result.topRagas).toHaveLength(10);
  });

  it('returns empty lists for no rows', () => {
    expect(computeRepertoire([])).toEqual({ topCompositions: [], topRagas: [] });
  });
});
