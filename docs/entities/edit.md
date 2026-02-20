# Edit Entity

ElectroDB Model: `edit` v1, service: `rasikalife`

## Attributes

| Attribute | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `id` | string | yes | - | Unique identifier |
| `entityType` | string | yes | - | Target entity type |
| `entityId` | string | yes | - | Target entity ID |
| `userId` | string | yes | - | Creator user ID |
| `status` | string | yes | draft | draft/submitted/approved/rejected/withdrawn |
| `proposedValues` | any | yes | - | Proposed changes |
| `operation` | string | no | update | update/delete |
| `userNote` | string | no | - | User's note |
| `moderatorId` | string | no | - | Moderator ID |
| `moderatorNote` | string | no | - | Moderator feedback |
| `submittedAt` | string | no | - | Submission timestamp |
| `processedAt` | string | no | - | Processing timestamp |
| `createdAt` | string | yes | auto | Creation timestamp |
| `updatedAt` | string | yes | auto | Last update timestamp |

## Indexes

| Index | Type | GSI | Key |
|-------|------|-----|-----|
| `primary` | primary | - | pk: `EDIT#${id}`, sk: `#METADATA` |
| `byStatus` | GSI | gsi1 | gsi1pk: `EDIT_STATUS#${status}`, gsi1sk: `${createdAt}` |
| `byPendingType` | GSI | gsi2 | gsi2pk: `EDIT_STATUS#${status}#${entityType}`, gsi2sk: `${createdAt}` |
| `byEntity` | GSI | gsi3 | gsi3pk: `EDIT_ENTITY#${entityType}#${entityId}`, gsi3sk: `${createdAt}` |
| `byUser` | GSI | gsi4 | gsi4pk: `EDIT_USER#${userId}`, gsi4sk: `${createdAt}` |

## Edit Statuses

- `draft` - Edit is being worked on
- `submitted` - Edit submitted for review
- `approved` - Edit approved by moderator
- `rejected` - Edit rejected by moderator
- `withdrawn` - User withdrew their edit

## Functions

```typescript
import { createDraft, submitEdit, withdrawEdit, approveEdit, rejectEdit, getEditById, getPendingEdits, getUserEdits, getEntityEdits, updateDraft, requestDeletion, requestMerge, getActiveEditForEntity } from '@rasika/core';
```

### Draft Management
- `createDraft(input)` → Edit
- `submitEdit(editId, userId)` → Edit
- `withdrawEdit(editId, userId)` → Edit
- `updateDraft(editId, userId, updates)` → Edit

### Moderation
- `approveEdit(editId, moderatorId)` → Edit
- `rejectEdit(editId, moderatorId, moderatorNote)` → Edit

### Queries
- `getEditById(editId)` → Edit | null
- `getPendingEdits(params?)` → `{items: Edit[], nextToken?, hasMore}`
- `getUserEdits(userId, params?)` → `{items: Edit[], nextToken?, hasMore}`
- `getEntityEdits(entityType, entityId, params?)` → `{items: Edit[], nextToken?, hasMore}`
- `getActiveEditForEntity(userId, entityType, entityId)` → Edit | null

### Special Operations
- `requestDeletion(entityType, entityId, moderatorId, userNote?)` → Edit
- `requestMerge(entityType, loserId, canonicalId, moderatorId, userNote?)` → Edit
