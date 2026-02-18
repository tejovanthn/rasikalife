export async function reindex() {
  const Search = await import('@rasika/core/domain/search');

  console.log('Building search index...');
  await Search.buildAndStoreSearchIndex();
  console.log('Done!');
}
