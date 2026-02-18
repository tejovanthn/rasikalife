// packages/core/src/domain/search/indexer.ts

import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import Fuse from 'fuse.js';
import { listArtists } from '../artist';
import { listCompositions } from '../composition';
import { listApprovedEvents } from '../event';
import { listOrganisers } from '../organiser';
import { listRagas } from '../raga';
import { listTalas } from '../tala';
import { listVenues } from '../venue';
import { transformToSearchDocuments } from './transformer';
import type { SearchDocument, SearchIndex } from './types';

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const INDEX_BUCKET = process.env.SEARCH_INDEX_BUCKET;

interface PaginatedResult<T> {
  items: T[];
  nextToken?: string;
  hasMore: boolean;
}

async function fetchAllPaginated<T>(
  listFn: (params?: { limit?: number; nextToken?: string }) => Promise<PaginatedResult<T>>,
  pageSize = 100
): Promise<T[]> {
  const allItems: T[] = [];
  let nextToken: string | undefined;

  do {
    const result = await listFn({ limit: pageSize, nextToken });
    allItems.push(...result.items);
    nextToken = result.nextToken;
  } while (nextToken);

  return allItems;
}

export async function buildSearchIndex(): Promise<SearchIndex> {
  console.log('Starting search index build');

  const [artists, ragas, talas, compositions, venues, organisers, events] = await Promise.all([
    fetchAllPaginated(listArtists),
    fetchAllPaginated(listRagas),
    fetchAllPaginated(listTalas),
    fetchAllPaginated(listCompositions),
    fetchAllPaginated(listVenues),
    fetchAllPaginated(listOrganisers),
    fetchAllPaginated(listApprovedEvents),
  ]);

  console.log(
    `Fetched entities: ${artists.length} artists, ${ragas.length} ragas, ${talas.length} talas, ${compositions.length} compositions, ${venues.length} venues, ${organisers.length} organisers, ${events.length} events`
  );

  const documents = transformToSearchDocuments(
    artists,
    ragas,
    talas,
    compositions,
    venues,
    organisers,
    events
  );

  const fuseIndex = Fuse.createIndex(['name', 'description'], documents);

  const searchIndex: SearchIndex = {
    version: 1,
    builtAt: new Date().toISOString(),
    documentCount: documents.length,
    fuseIndex: fuseIndex.toJSON(),
    documents,
  };

  console.log(`Search index built: ${documents.length} documents`);

  return searchIndex;
}

export async function storeSearchIndex(index: SearchIndex): Promise<void> {
  if (!INDEX_BUCKET) {
    throw new Error('SEARCH_INDEX_BUCKET environment variable is not set');
  }

  const indexKey = `search-index/${new Date().toISOString().split('T')[0]}/index.json`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: INDEX_BUCKET,
      Key: indexKey,
      Body: JSON.stringify(index),
      ContentType: 'application/json',
      CacheControl: 'max-age=21600',
    })
  );

  await s3Client.send(
    new PutObjectCommand({
      Bucket: INDEX_BUCKET,
      Key: 'search-index/latest/index.json',
      Body: JSON.stringify(index),
      ContentType: 'application/json',
    })
  );

  console.log(`Search index stored: ${indexKey} (latest pointer updated)`);
}

export async function buildAndStoreSearchIndex(): Promise<void> {
  const index = await buildSearchIndex();
  await storeSearchIndex(index);
}
