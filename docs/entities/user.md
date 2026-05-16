# User Entity

ElectroDB Model: `user` v2, service: `rasikalife`

## Attributes

| Attribute | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `id` | string | yes | - | Unique identifier |
| `email` | string | yes | - | User email |
| `name` | string | yes | - | User name (from OAuth) |
| `picture` | string | no | - | Profile picture URL |
| `googleId` | string | yes | - | Google OAuth ID |
| `role` | string | yes | editor | editor/moderator/admin |
| `trustLevel` | string | no | new | Contribution quality tier: `new` / `established` / `trusted` / `curator`. Orthogonal to `role` — role governs operational permissions, trustLevel governs contribution weight. Set manually by admins in v1. |
| `username` | string | no | - | URL-safe slug derived from `displayName` or `name`. Unique. Used for `/u/:username` public profile. Auto-assigned on first `updatePreferences` call. |
| `preferences` | map | no | - | User preference overrides. Effective preferences (with defaults applied) are read via `getEffectivePreferences(user)`. Keys: `theme`, `contentLanguage`, `contributeToPublicSetlists`, `attendanceVisible`, `showProfilePublicly`, `displayName`, `bio`. |
| `createdAt` | string | yes | auto | Creation timestamp (readOnly) |
| `lastSignedInAt` | string | yes | auto | Last sign-in timestamp |

## Indexes

| Index | Type | GSI | Key |
|-------|------|-----|-----|
| `primary` | primary | - | pk: `USER#${id}`, sk: `#METADATA` |
| `byEmail` | GSI | gsi1 | gsi1pk: `USER_EMAIL#${email}`, gsi1sk: `USER#${id}` |
| `byGoogleId` | GSI | gsi2 | gsi2pk: `USER_GOOGLE_ID#${googleId}`, gsi2sk: `USER#${id}` |
| `byUsername` | GSI | gsi3 | gsi3pk: `USER_USERNAME#${username}`, gsi3sk: `USER#${id}` |

## Roles vs Trust Levels

**role** — operational permissions:
- `editor` — can create drafts, submit edits
- `moderator` — can approve/reject edits, events, and setlist items
- `admin` — full system access

**trustLevel** — contribution quality signal (orthogonal to role):
- `new` — default; free-text setlist items always queued for moderation
- `established` — 10+ corroborated linked items, 30+ days since signup
- `trusted` — 100+ corroborated items, no recent rejections
- `curator` — manually promoted by admin; contributions carry higher reconciliation weight

## Functions

```typescript
import { User } from '@rasika/core'; // namespace: User.createUser(), User.getUser(), etc.
// or individually:
import { createUser, getUser, getUserByEmail, getUserByGoogleId, updateUser, updateLastSignedIn, updateUserRole, findOrCreateUser, listAllUsers } from '@rasika/core/domain/user';
```

### CRUD
- `createUser(input)` → User
- `getUser(id)` → User | null
- `getUserByEmail(email)` → User | null
- `getUserByGoogleId(googleId)` → User | null
- `getUserByUsername(username)` → User | null — GSI lookup, O(1)
- `updateUser(id, input)` → User
- `updateLastSignedIn(id)` → User
- `updateUserRole(id, role)` → User

### Authentication
- `findOrCreateUser(profile)` → User

### Preferences
- `getEffectivePreferences(user)` → `Required<UserPreferences>` — merges stored preferences with defaults; `displayName` falls back to `user.name` when empty
- `updateUserPreferences(id, partial)` → `Required<UserPreferences>` — deep-merges, auto-generates a unique `username` slug when `displayName` changes (tries base slug, then `slug-2`…`slug-99`, finally `slug-${userId.slice(-6)}`)

### Listing
- `listAllUsers()` → User[]
