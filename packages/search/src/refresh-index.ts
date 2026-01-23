// packages/search/src/refresh-index.ts

import { Search } from '@rasika/core';

export async function handler(): Promise<void> {
  console.log('Starting scheduled index refresh');

  try {
    await Search.buildAndStoreSearchIndex();
    console.log('Scheduled index refresh completed');
  } catch (error) {
    console.error('Scheduled index refresh failed', { error });
    throw error;
  }
}
