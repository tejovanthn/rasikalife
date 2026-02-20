# User Entity

ElectroDB Model: `user` v2, service: `rasikalife`

## Attributes

| Attribute | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `id` | string | yes | - | Unique identifier |
| `email` | string | yes | - | User email |
| `name` | string | yes | - | User name |
| `picture` | string | no | - | Profile picture URL |
| `googleId` | string | yes | - | Google OAuth ID |
| `role` | string | yes | editor | editor/moderator/admin |
| `createdAt` | string | yes | auto | Creation timestamp |
| `lastSignedInAt` | string | yes | auto | Last sign-in timestamp |

## Indexes

| Index | Type | GSI | Key |
|-------|------|-----|-----|
| `primary` | primary | - | pk: `USER#${id}`, sk: `#METADATA` |
| `byEmail` | GSI | gsi1 | gsi1pk: `USER_EMAIL#${email}`, gsi1sk: `USER#${id}` |
| `byGoogleId` | GSI | gsi2 | gsi2pk: `USER_GOOGLE_ID#${googleId}`, gsi2sk: `USER#${id}` |

## Roles

- `editor` - Can create drafts, submit edits
- `moderator` - Can approve/reject edits and events
- `admin` - Full system access

## Functions

```typescript
import { createUser, getUser, getUserByEmail, getUserByGoogleId, updateUser, updateLastSignedInAt, updateUserRole, findOrCreateUser, listAllUsers } from '@rasika/core';
```

### CRUD
- `createUser(input)` → User
- `getUser(id)` → User | null
- `getUserByEmail(email)` → User | null
- `getUserByGoogleId(googleId)` → User | null
- `updateUser(id, input)` → User
- `updateLastSignedIn(id)` → User
- `updateUserRole(id, role)` → User

### Authentication
- `findOrCreateUser(profile)` → User

### Listing
- `listAllUsers()` → User[]
