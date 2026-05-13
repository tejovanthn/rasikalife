# SocialPost Entity

ElectroDB Model: `social-post` v1, service: `rasikalife`

Tracks social media posts scraped by the scraper package, and their processing status for AI event extraction.

## Attributes

| Attribute | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `platform` | string | yes | - | Platform name (e.g. `instagram`) — part of PK |
| `platformPostId` | string | yes | - | Platform's post ID — part of PK |
| `entityType` | string | yes | - | Linked entity type (e.g. `organiser`) |
| `entityId` | string | yes | - | Linked entity ID |
| `handle` | string | yes | - | Social media handle |
| `postUrl` | string | yes | - | URL to the post |
| `postText` | string | no | - | Post caption/text |
| `mediaUrls` | list\<string\> | no | `[]` | Media URLs from post |
| `postedAt` | string | yes | - | Post timestamp (ISO) |
| `processedAt` | string | no | - | Processing completion timestamp |
| `processingStatus` | string | yes | `pending` | `pending`, `processed`, `skipped`, `failed` |
| `extractedEventId` | string | no | - | Event created from this post |
| `errorMessage` | string | no | - | Error detail on failure |
| `createdAt` | string | yes | auto | Creation timestamp |
| `updatedAt` | string | yes | auto | Last update timestamp |

## Indexes

| Index | Type | GSI | Key |
|-------|------|-----|-----|
| `primary` | primary | - | pk: `SOCIAL_POST#${platform}#${platformPostId}`, sk: `#METADATA` |
| `byEntity` | GSI | gsi1 | gsi1pk: `SOCIAL_POST_ENTITY#${entityType}#${entityId}`, gsi1sk: `${postedAt}` |
| `byStatus` | GSI | gsi2 | gsi2pk: `SOCIAL_POST_STATUS#${processingStatus}`, gsi2sk: `${postedAt}` |

## Notes

- `createSocialPost` uses upsert for idempotency — safe to call on re-scrape.

## Functions

```typescript
import { SocialPost } from '@rasika/core'; // namespace: SocialPost.createSocialPost(), etc.
// or individually:
import { createSocialPost, getSocialPost, updateSocialPostStatus, markProcessed, markSkipped, markFailed, listPendingPosts, listPostsByStatus, listPostsByEntity, getLatestPostIdForEntity } from '@rasika/core/domain/social-post';
```

### CRUD
- `createSocialPost(input)` → SocialPost (upsert)
- `getSocialPost(platform, platformPostId)` → SocialPost | null
- `updateSocialPostStatus(platform, platformPostId, update)` → SocialPost

### Status Helpers
- `markProcessed(platform, platformPostId, extractedEventId?)` → void
- `markSkipped(platform, platformPostId)` → void
- `markFailed(platform, platformPostId, errorMessage)` → void

### Listing
- `listPendingPosts(params?)` → `{items: SocialPost[], nextToken?, hasMore}`
- `listPostsByStatus(status, params?)` → `{items: SocialPost[], nextToken?, hasMore}` — generic status query (`pending` | `processed` | `skipped` | `failed`)
- `listPostsByEntity(entityType, entityId, params?)` → `{items: SocialPost[], nextToken?, hasMore}`
- `getLatestPostIdForEntity(entityType, entityId)` → `string | null`
