# ADR-029: Instagram Scraping Pipeline

## Status
Accepted

## Context
A significant portion of Indian classical arts event announcements are posted on Instagram by organisers, sabhas, and venues. We wanted to automatically discover and ingest these posts to reduce manual event entry.

Requirements:
- Scrape recent posts from known Instagram handles (artists, organisers, venues)
- Run on a schedule without manual intervention
- Extract structured event data from post captions and images
- Handle failures gracefully without losing posts
- Avoid re-processing posts already seen

## Decision
Use a **three-Lambda orchestration pipeline** with SQS for decoupled extraction:

```
EventBridge Cron (daily)
    ↓
InstagramSyncOrchestrator Lambda
    ↓ async invoke per handle
InstagramScraper Lambda (one per handle)
    ↓ SQS message per new post
InstagramPostQueue (SQS + DLQ)
    ↓ trigger
SocialPostExtractor Lambda
    ↓
Draft Event in DynamoDB
```

**Instagram scraping** uses Instagram's unofficial web API (`/api/v1/users/web_profile_info/`) — plain `fetch()` with a spoofed User-Agent and Instagram app ID. No headless browser.

**Deduplication**: each handle stores the latest seen post ID; scraper fetches only posts newer than that (max 30 posts per run). Posts are written as `SocialPost` records with `processingStatus: 'pending'` before extraction.

**Extraction**: SQS-triggered Lambda sends post text + optional image to Gemini. Posts with confidence < 0.3 are marked `skipped`. Failures go to DLQ.

## Consequences

### Positive
- ✅ **No headless browser**: Plain HTTP fetch is simpler, cheaper, and faster than Playwright/Puppeteer in Lambda
- ✅ **Decoupled**: Scraping and extraction are separate — a Gemini outage doesn't block scraping
- ✅ **DLQ for extraction failures**: Failed extractions are retryable, not lost
- ✅ **Idempotent writes**: `SocialPost.createSocialPost` uses upsert — re-runs are safe
- ✅ **Incremental**: Only new posts (since last seen ID) are fetched

### Negative
- ❌ **Unofficial API**: Instagram's web API is undocumented and subject to breaking changes or IP blocks without notice
- ❌ **Rate limiting risk**: High-frequency scraping across many handles could trigger Instagram rate limits
- ❌ **Fan-out via async Lambda invoke**: Failures in individual scraper invocations aren't visible to the orchestrator (fire-and-forget)
- ❌ **Daily cadence only**: Posts from the past 24 hours may be missed if Instagram returns a shorter window
- ❌ **Single-event extraction**: Only the first event from a multi-event post is created

## Alternatives Considered

### Official Instagram Graph API
- **Pros**: Stable, documented, rate limits are known
- **Cons**: Requires each organiser to authorise the app; impractical for community data
- **Why rejected**: Consent flow is a blocker for passive discovery

### Headless browser (Playwright/Puppeteer)
- **Pros**: More robust to API changes, can handle dynamic content
- **Cons**: 300-500MB Lambda layer, slow startup, significantly higher cost, higher chance of bot detection
- **Why rejected**: Unnecessary given the unofficial API works with plain fetch

### SQS fan-out from orchestrator (instead of async Lambda invoke)
- **Pros**: Better visibility into per-handle failures, natural retry
- **Cons**: Adds another queue, more infrastructure
- **Why rejected**: Scraper failures are low-risk (posts are just skipped); direct invoke keeps it simpler

## Implementation Details

**Infrastructure** (`infra/instagram.ts`):
- `InstagramPostQueue`: SQS with 12-minute visibility timeout (6× Lambda timeout, per AWS recommendation), DLQ attached
- `InstagramScraper`: 256MB, 5-minute timeout, invoked async per handle
- `SocialPostExtractor`: 512MB, 2-minute timeout, SQS subscriber
- `InstagramSyncOrchestrator`: 256MB, 5-minute timeout, daily cron via EventBridge

**Scraper** (`packages/scraper/src/handler.ts`, `instagram.ts`):
- Queries all Artist/Organiser/Venue entities with Instagram links
- Fetches up to 30 posts newer than the last stored post ID
- Writes `SocialPost` records (upsert)
- Enqueues SQS message per new post

**Extractor** (`packages/scraper/src/extractor.ts`):
- Skips posts with `processingStatus !== 'pending'` (idempotent)
- Confidence threshold: 0.3
- Creates draft events attributed to `system-instagram-extractor` user

## References
- `infra/instagram.ts` — infrastructure
- `packages/scraper/src/` — orchestrator, handler, extractor, instagram API client
- ADR-026: Gemini AI for event extraction
- `docs/entities/social-post.md` — SocialPost entity
