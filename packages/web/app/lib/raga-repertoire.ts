type Repertoire<T> = { performanceCount: number; topCompositions: T[] };

const TOP_COMPOSITIONS_SHOWN = 5;

// getRepertoireStats returns null when the raga is gone by the time it runs.
// The page still renders, with no logged performances.
export function repertoireView<T>(stats: Repertoire<T> | null): Repertoire<T> {
  if (!stats) return { performanceCount: 0, topCompositions: [] };
  return {
    performanceCount: stats.performanceCount,
    topCompositions: stats.topCompositions.slice(0, TOP_COMPOSITIONS_SHOWN),
  };
}
