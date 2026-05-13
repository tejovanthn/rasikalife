# Content Entity

ElectroDB Model: `content` v1, service: `rasikalife`

## Attributes

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | yes | Unique identifier |
| `path` | string | yes | URL path |
| `content` | string | yes | Markdown content |
| `category` | string | yes | Content category |
| `status` | string | yes | draft/published |
| `visibility` | string | yes | public/private |
| `editorId` | string | yes | Editor user ID |
| `meta` | map | yes | `{title, description, keywords, robots?}` |
| `navigation` | map | no | `{breadcrumbs, menuPlacement?, relatedPages}` |
| `createdAt` | string | yes | Creation timestamp |
| `updatedAt` | string | yes | Last update timestamp |

## Indexes

| Index | Type | GSI | Key |
|-------|------|-----|-----|
| `primary` | primary | - | pk: `CONTENT#${id}`, sk: `#METADATA` |
| `byPath` | GSI | gsi1 | gsi1pk: `CONTENT_PATH#${path}`, gsi1sk: `CONTENT#${id}` |
| `byCategory` | GSI | gsi2 | gsi2pk: `CONTENT_CATEGORY#${category}`, gsi2sk: `CONTENT#${id}` |
| `list` | GSI | gsi3 | gsi3pk: `CONTENT_LIST`, gsi3sk: `${updatedAt}#${id}` |

## Functions

```typescript
import { Content } from '@rasika/core'; // namespace: Content.createContent(), etc.
// or individually:
import { createContent, getContent, getContentByPath, updateContent, deleteContent, listContents, listPublishedContents, getContentsByCategory } from '@rasika/core/domain/content';
```

### CRUD
- `createContent(input)` → Content
- `getContent(id)` → ContentWithRelations | null
- `getContentByPath(path)` → ContentWithRelations | null
- `updateContent(id, input)` → Content
- `deleteContent(id)` → void

### Listing
- `listContents(params?)` → `{items: ContentWithRelations[], nextToken?, hasMore}`
- `listPublishedContents(params?)` → `{items: ContentWithRelations[], nextToken?, hasMore}`
- `getContentsByCategory(category)` → ContentWithRelations[]
