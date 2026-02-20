# Festival Entity

ElectroDB Model: `festival` v1, service: `rasikalife`

## Attributes

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | yes | Unique identifier |
| `name` | string | yes | Festival name |
| `description` | string | no | Festival description |
| `startDate` | string | yes | Start date (ISO) |
| `endDate` | string | yes | End date (ISO) |
| `posterUrl` | string | no | Poster image URL |
| `posterUploadId` | string | no | Upload reference |
| `organiserId` | string | no | Linked organiser |
| `organiserName` | string | no | Organiser name (denormalized) |
| `tags` | list\<string\> | no | Tags |
| `sponsors` | any | no | Sponsors list |
| `status` | string | yes | draft/submitted/approved |
| `moderatorId` | string | no | Approver ID |
| `moderatorNote` | string | no | Moderator feedback |
| `submittedAt` | string | no | Submission timestamp |
| `processedAt` | string | no | Processing timestamp |
| `createdBy` | string | yes | Creator user ID |
| `createdAt` | string | yes | Creation timestamp |
| `updatedAt` | string | yes | Last update timestamp |

## Indexes

| Index | Type | GSI | Key |
|-------|------|-----|-----|
| `primary` | primary | - | pk: `FESTIVAL#${id}`, sk: `#METADATA` |
| `byCreator` | GSI | gsi1 | gsi1pk: `USER#${createdBy}`, gsi1sk: `FESTIVAL#${createdAt}` |
| `byStatus` | GSI | gsi2 | gsi2pk: `FESTIVAL_STATUS#${status}`, gsi2sk: `${startDate}` |

## Functions

```typescript
import { createFestival, getFestival, updateFestival, submitFestival, approveFestival, deleteFestival, listFestivals, listApprovedFestivalsByMonth } from '@rasika/core';
```

### CRUD
- `createFestival(input, userId)` → Festival
- `getFestival(id)` → Festival | null
- `updateFestival(id, input)` → Festival
- `deleteFestival(id)` → void

### Workflow
- `submitFestival(id)` → Festival
- `approveFestival(id, moderatorId?)` → Festival

### Listing
- `listFestivals(params?)` → `{items: Festival[], nextToken?, hasMore}`
- `listApprovedFestivalsByMonth(yearMonth)` → Festival[]
