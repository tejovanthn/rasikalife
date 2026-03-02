# ChangeHistory Entity

ElectroDB Model: `change_history` v1, service: `rasikalife`

Audit log of field-level changes to entities. Supports `composition`, `raga`, `tala`, and `artist`.

## Attributes

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | yes | Unique identifier |
| `entityType` | string | yes | Entity type (`composition`, `raga`, `tala`, `artist`) |
| `entityId` | string | yes | ID of the changed entity |
| `userId` | string | yes | User who made the change |
| `timestamp` | number | yes | Unix timestamp in ms (auto) |
| `action` | string | yes | `create`, `update`, `delete`, or `rollback` |
| `diff` | list\<map\> | yes | `{field, oldValue?, newValue?}[]` |
| `comment` | string | no | Optional editor comment |

## Indexes

| Index | Type | GSI | Key |
|-------|------|-----|-----|
| `primary` | primary | - | pk: `ENTITY#${entityType}#${entityId}`, sk: `CHANGE#${timestamp}#${userId}#${id}` |
| `byUser` | GSI | gsi1 | gsi1pk: `USER#${userId}`, gsi1sk: `${timestamp}#${id}` |

## Functions

```typescript
import { createChangeHistory, getChangeHistory, getUserChanges, getEntityStateAtTimestamp, computeDiff } from '@rasika/core';
```

- `createChangeHistory(input)` → ChangeHistory
- `getChangeHistory(entityType, entityId, params?)` → `{items: ChangeHistory[], nextToken?, hasMore}` (desc order)
- `getUserChanges(userId, params?)` → `{items: ChangeHistory[], nextToken?, hasMore}` (desc order)
- `getEntityStateAtTimestamp(entityType, entityId, targetTimestamp)` → `{change, stateBefore} | null`
- `computeDiff(before, after)` → `{field, oldValue?, newValue?}[]`
