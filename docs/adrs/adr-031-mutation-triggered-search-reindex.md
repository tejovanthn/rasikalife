# ADR-031: Mutation-Triggered Search Reindex with In-Process Throttle

## Status
Accepted

## Context
ADR-017 established that Fuse.js with an S3-stored index is used for search, rebuilt every 6 hours via EventBridge cron. However, a 6-hour staleness window means a newly created artist, event, or composition won't appear in search results for up to 6 hours.

We needed a way to make search results fresher after mutations without the cost and complexity of real-time indexing.

## Decision
Mutations that change searchable entities **async-invoke the search reindex Lambda** immediately after completing, subject to a **5-minute in-process throttle**.

The throttle is a module-level timestamp (`lastTriggeredAt`). If fewer than 5 minutes have passed since the last trigger within the same Lambda instance, the invocation is skipped. The reindex Lambda is called with `InvocationType: 'Event'` (fire-and-forget).

Mutations that trigger reindex: artist create/update/approve, composition create/update/approve, raga create/update, tala create/update, organiser create/update, event approve.

## Consequences

### Positive
- ✅ **Near-real-time for low-traffic scenarios**: A single mutation in a quiet period triggers an immediate reindex — results are fresh within ~30 seconds
- ✅ **No additional infrastructure**: Reuses the same Lambda and S3 bucket already established in ADR-017
- ✅ **Fire-and-forget**: Mutation response is not delayed by the reindex
- ✅ **Throttle prevents stampedes**: A batch of mutations (e.g. bulk approval) triggers at most one reindex per 5 minutes

### Negative
- ❌ **In-process throttle is per-instance**: Each warm Lambda instance has its own `lastTriggeredAt`. Under concurrent traffic, multiple instances could each independently trigger a reindex within the same 5-minute window
- ❌ **Not guaranteed**: If the trigger invocation fails (Lambda capacity, permissions), the mutation still succeeds but the index is only refreshed at the next cron cycle
- ❌ **Staleness still possible**: The 5-minute throttle means rapid successive mutations may not all trigger a reindex immediately

## Alternatives Considered

### EventBridge event on mutation → reindex
- **Pros**: Decoupled, observable, retryable
- **Cons**: More infrastructure, still has the per-instance duplication problem without deduplication logic
- **Why rejected**: Added complexity for marginal benefit at current scale

### Real-time index updates (write to S3 on every mutation)
- **Pros**: Always fresh
- **Cons**: High S3 write cost, concurrency issues with partial index updates, complex merge logic
- **Why rejected**: Fuse.js index is a single JSON blob — partial updates aren't possible without a full rebuild

### SQS with deduplication for reindex requests
- **Pros**: True deduplication across Lambda instances, retryable
- **Cons**: Additional infrastructure, visibility timeout complexity
- **Why rejected**: Over-engineered for current data size and traffic

## Implementation Details

`packages/trpc/src/reindex.ts`:
```typescript
const THROTTLE_MS = 5 * 60 * 1000; // 5 minutes
let lastTriggeredAt = 0;

export function triggerReindex(): void {
  const now = Date.now();
  if (now - lastTriggeredAt < THROTTLE_MS) return;
  lastTriggeredAt = now;

  lambdaClient.send(new InvokeCommand({
    FunctionName: process.env.SEARCH_REINDEX_FUNCTION_NAME,
    InvocationType: 'Event',  // async, fire-and-forget
    Payload: Buffer.from('{}'),
  })).catch(err => console.error('[reindex] Failed to trigger reindex', err));
}
```

`triggerReindex()` is called (without `await`) at the end of mutation procedures in: `artist.ts`, `composition.ts`, `raga.ts`, `tala.ts`, `organiser.ts` routers.

## References
- ADR-017: Fuse.js client-side search (search architecture)
- `packages/trpc/src/reindex.ts`
- `infra/search.ts` (SearchIndexCron, SearchReindex Lambda)
