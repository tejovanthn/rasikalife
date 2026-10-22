export async function reindex() {
  const Search = await import('@rasika/core/domain/search');

  console.log('Building search index...');
  await Search.buildAndStoreSearchIndex();
  // Every data script ends with a reindex, so this is where hand-run edits clear the page
  // cache (signed-out pages are cached for a week).
  const { invalidateSiteCache } = await import('@rasika/core/site-cache');
  await invalidateSiteCache('cli reindex');
  console.log('Done!');
}
