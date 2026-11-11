/**
 * A DynamoDB batch get may hand back some keys as `unprocessed` (throttling, size cap). Reading
 * only `data` then drops those rows without a word, which is how a consented follower goes
 * missing from an export. This retries the leftovers with backoff and throws if any remain.
 */
export interface BatchGetResult<K, R> {
  data?: R[] | null;
  unprocessed?: K[] | null;
}

export interface BatchGetOptions {
  /** Retries after the first attempt. Default 4. */
  retries?: number;
  /** First backoff in ms, doubled each retry. Default 100. */
  baseDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

export async function batchGetAll<K, R>(
  keys: K[],
  get: (keys: K[]) => Promise<BatchGetResult<K, R>>,
  options: BatchGetOptions = {}
): Promise<R[]> {
  const retries = options.retries ?? 4;
  const base = options.baseDelayMs ?? 100;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>(r => setTimeout(r, ms)));
  const rows: R[] = [];
  let pending = keys;
  for (let attempt = 0; pending.length > 0; attempt++) {
    const result = await get(pending);
    rows.push(...(result.data ?? []));
    pending = result.unprocessed ?? [];
    if (pending.length === 0) break;
    if (attempt >= retries) {
      throw new Error(`Batch get left ${pending.length} keys unprocessed after ${retries} retries`);
    }
    await sleep(base * 2 ** attempt);
  }
  return rows;
}
