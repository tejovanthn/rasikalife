# Core RBAC System (Final)

> **Status:** v2.1-final-corrected - Corrected edit entities
> **Previous Version:** [250130-02d-rbac-core-only.md](./250130-02d-rbac-core-only.md)
> **Feedback:** User correction on editable entities

## Overview

This specification defines a core Role-Based Access Control (RBAC) system for Carnatic music content. The system supports:

- **Single role per user** for simplicity and clarity (with documented migration path for multi-role)
- **Change history tracking** with diffs for audit and rollback capabilities
- **Three roles**: Editor, Moderator, Admin with escalating privileges
- **Permission-based authorization** using a single `can()` function

Authenticated users (editors) can edit: **compositions, ragas, talas, artists** - not pages.

## Changes from Iteration 2d

| Area | Iteration 2d | Final Corrected |
|------|--------------|-----------------|
| Editable entities | 'composition', 'page' | **'composition', 'raga', 'tala', 'artist'** |
| Editor permissions | 'edit_compositions', 'edit_pages' | **'edit_compositions', 'edit_ragas', 'edit_talas', 'edit_artists'** |
| ChangeHistory entityTypes | 'composition', 'page' | **'composition', 'raga', 'tala', 'artist'** |
| Protect permission | 'protect_page' | **'protect_entity'** (semantic fix) |

---

## Requirements

### 1. Single Role per User

> **Decision:** User confirmed switching from `roles: Role[]` to `role: Role` for simplicity. The migration path to multi-role is documented at the end.

```typescript
// Single role field - simpler and clearer
role: {
  type: 'string',
  enum: Object.values(ROLE),
  required: true,
  default: () => ROLE.EDITOR,
}
```

### 2. Change History Table

DynamoDB table for audit logs with minimal diffs:

```typescript
PK: 'ENTITY#<entityType>#<entityId>'
SK: 'CHANGE#<timestamp>#<userId>'
entityType: 'composition' | 'raga' | 'tala' | 'artist'
entityId: string
userId: string
timestamp: number
diff: { [fieldName: string]: unknown }  // Only changed fields
```

The history table supports:
- Query all changes to an entity (reverse chronological)
- Get latest N changes by user
- Rollback by reversing the diff

### 3. Core Roles

```typescript
export const ROLE = {
  EDITOR: 'editor',      // All authenticated users start here
  MODERATOR: 'moderator', // Can rollback, protect, view IPs
  ADMIN: 'admin',        // Full access
} as const;

export const PERMISSION = {
  EDIT_COMPOSITIONS: 'edit_compositions',
  EDIT_RAGAS: 'edit_ragas',
  EDIT_TALAS: 'edit_talas',
  EDIT_ARTISTS: 'edit_artists',
  ROLLBACK_CHANGES: 'rollback_changes',
  PROTECT_ENTITY: 'protect_entity',
  VIEW_IP_ADDRESSES: 'view_ip_addresses',
  MANAGE_USERS: 'manage_users',
  MANAGE_ROLES: 'manage_roles',
} as const;

export const rolePermissions: Record<Role, readonly Permission[]> = {
  [ROLE.EDITOR]: [
    PERMISSION.EDIT_COMPOSITIONS,
    PERMISSION.EDIT_RAGAS,
    PERMISSION.EDIT_TALAS,
    PERMISSION.EDIT_ARTISTS,
  ],
  [ROLE.MODERATOR]: [
    PERMISSION.EDIT_COMPOSITIONS,
    PERMISSION.EDIT_RAGAS,
    PERMISSION.EDIT_TALAS,
    PERMISSION.EDIT_ARTISTS,
    PERMISSION.ROLLBACK_CHANGES,
    PERMISSION.PROTECT_ENTITY,
    PERMISSION.VIEW_IP_ADDRESSES,
  ],
  [ROLE.ADMIN]: [
    PERMISSION.EDIT_COMPOSITIONS,
    PERMISSION.EDIT_RAGAS,
    PERMISSION.EDIT_TALAS,
    PERMISSION.EDIT_ARTISTS,
    PERMISSION.ROLLBACK_CHANGES,
    PERMISSION.PROTECT_ENTITY,
    PERMISSION.VIEW_IP_ADDRESSES,
    PERMISSION.MANAGE_USERS,
    PERMISSION.MANAGE_ROLES,
  ],
};
```

### 4. User Entity Changes

```typescript
role: {
  type: 'string',
  enum: Object.values(ROLE),
  required: true,
  default: () => ROLE.EDITOR,  // All users start as editors
}
```

### 5. The can() Function

```typescript
export function can(role: Role, permission: Permission): boolean {
  const perms = rolePermissions[role];
  return perms.includes(permission);
}
```

---

## Technical Design

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      tRPC Layer                                  │
├─────────────────────────────────────────────────────────────────┤
│  protectedProcedure → requiresAuth middleware                    │
│  editorProcedure → requirePermission('edit_compositions')        │
│  moderatorProcedure → requirePermission('rollback_changes')      │
├─────────────────────────────────────────────────────────────────┤
│                     Core Layer                                   │
├─────────────────────────────────────────────────────────────────┤
│  can() function          │  rolePermissions map                 │
│  ────────────────────────│──────────────────────────────────────│
│  User entity (updated)   │  ChangeHistory entity (new)          │
│                          │  Permission utilities                 │
├─────────────────────────────────────────────────────────────────┤
│                   DynamoDB Layer                                 │
├─────────────────────────────────────────────────────────────────┤
│  UserTable (updated)     │  HistoryTable (new)                  │
└─────────────────────────────────────────────────────────────────┘
```

### Database Schema

#### User Entity (Updated)

**File:** `packages/core/src/domain/user/entity.ts`

```typescript
import { Entity } from 'electrodb';
import type { EntityItem } from 'electrodb';
import { dynamoClient } from '../../db/client';
import { ROLE } from '../../auth/roles';

export const UserEntity = new Entity(
  {
    model: {
      entity: 'user',
      version: '2',
      service: 'rasikalife',
    },
    attributes: {
      id: {
        type: 'string',
        required: true,
      },
      email: {
        type: 'string',
        required: true,
      },
      name: {
        type: 'string',
        required: true,
      },
      picture: {
        type: 'string',
        required: false,
      },
      googleId: {
        type: 'string',
        required: true,
      },
      role: {
        type: 'string',
        enum: Object.values(ROLE),
        required: true,
        default: () => ROLE.EDITOR,
      },
      createdAt: {
        type: 'string',
        required: true,
        default: () => new Date().toISOString(),
        readOnly: true,
      },
      lastSignedInAt: {
        type: 'string',
        required: true,
        default: () => new Date().toISOString(),
        set: () => new Date().toISOString(),
      },
    },
    indexes: {
      primary: {
        pk: {
          field: 'pk',
          composite: ['id'],
          template: 'USER#${id}',
        },
        sk: {
          field: 'sk',
          composite: [],
          template: '#METADATA',
        },
      },
      byEmail: {
        index: 'gsi1',
        pk: {
          field: 'gsi1pk',
          composite: ['email'],
          template: 'USER_EMAIL#${email}',
        },
        sk: {
          field: 'gsi1sk',
          composite: ['id'],
          template: 'USER#${id}',
        },
      },
      byGoogleId: {
        index: 'gsi2',
        pk: {
          field: 'gsi2pk',
          composite: ['googleId'],
          template: 'USER_GOOGLE_ID#${googleId}',
        },
        sk: {
          field: 'gsi2sk',
          composite: ['id'],
          template: 'USER#${id}',
        },
      },
    },
  },
  { client: dynamoClient, table: process.env.DYNAMODB_TABLE || 'RasikaLifeTable' }
);

export type User = EntityItem<typeof UserEntity>;
```

#### ChangeHistory Entity (Simplified)

**Changes from Iteration 1:**
- Removed `userName` field (denormalized data - look up from User table when needed)
- Changed `diff` to store only changed fields (not full before/after snapshots)
- Removed `byTimestamp` and `list` indexes (keep only primary and byUser)
- Removed 'page' from entityType enum, added 'raga', 'tala', 'artist'

**File:** `packages/core/src/domain/change-history/entity.ts`

```typescript
import { Entity } from 'electrodb';
import type { EntityItem } from 'electrodb';
import { dynamoClient } from '../../db/client';
import { ChangeHistoryEntityType } from './types';

export const ChangeHistoryEntity = new Entity(
  {
    model: {
      entity: 'change_history',
      version: '2',
      service: 'rasikalife',
    },
    attributes: {
      id: {
        type: 'string',
        required: true,
      },
      entityType: {
        type: 'string',
        required: true,
        enum: Object.values(ChangeHistoryEntityType),
      },
      entityId: {
        type: 'string',
        required: true,
      },
      userId: {
        type: 'string',
        required: true,
      },
      timestamp: {
        type: 'number',
        required: true,
        default: () => Date.now(),
      },
      action: {
        type: 'string',
        required: true,
        enum: ['create', 'update', 'delete', 'rollback'],
      },
      diff: {
        type: 'map',
        required: true,
        // Example: { "title": "Old Title", "composer": "previous_composer" }
      },
      comment: {
        type: 'string',
        required: false,
      },
    },
    indexes: {
      primary: {
        pk: {
          field: 'pk',
          composite: ['entityType', 'entityId'],
          template: 'ENTITY#${entityType}#${entityId}',
        },
        sk: {
          field: 'sk',
          composite: ['timestamp', 'userId', 'id'],
          template: 'CHANGE#${timestamp}#${userId}#${id}',
        },
      },
      byUser: {
        index: 'gsi1',
        pk: {
          field: 'gsi1pk',
          composite: ['userId'],
          template: 'USER#${userId}',
        },
        sk: {
          field: 'gsi1sk',
          composite: ['timestamp', 'id'],
          template: '${timestamp}#${id}',
        },
      },
    },
  },
  { client: dynamoClient, table: process.env.DYNAMODB_TABLE || 'RasikaLifeTable' }
);

export type ChangeHistory = EntityItem<typeof ChangeHistoryEntity>;
```

#### ChangeHistory Types

**File:** `packages/core/src/domain/change-history/types.ts`

```typescript
export const CHANGE_ENTITY_TYPE = {
  COMPOSITION: 'composition',
  RAGA: 'raga',
  TALA: 'tala',
  ARTIST: 'artist',
} as const;

export type ChangeEntityType =
  (typeof CHANGE_ENTITY_TYPE)[keyof typeof CHANGE_ENTITY_TYPE];

export interface ChangeHistoryInput {
  entityType: ChangeEntityType;
  entityId: string;
  userId: string;
  action: 'create' | 'update' | 'delete' | 'rollback';
  diff: Record<string, unknown>;
  comment?: string;
}
```

### Permission System (Consolidated)

#### Roles Definition

**File:** `packages/core/src/auth/roles.ts`

```typescript
export const ROLE = {
  EDITOR: 'editor',
  MODERATOR: 'moderator',
  ADMIN: 'admin',
} as const;

export type Role = (typeof ROLE)[keyof typeof ROLE];

export const PERMISSION = {
  EDIT_COMPOSITIONS: 'edit_compositions',
  EDIT_RAGAS: 'edit_ragas',
  EDIT_TALAS: 'edit_talas',
  EDIT_ARTISTS: 'edit_artists',
  ROLLBACK_CHANGES: 'rollback_changes',
  PROTECT_ENTITY: 'protect_entity',
  VIEW_IP_ADDRESSES: 'view_ip_addresses',
  MANAGE_USERS: 'manage_users',
  MANAGE_ROLES: 'manage_roles',
} as const;

export type Permission = (typeof PERMISSION)[keyof typeof PERMISSION];

export const rolePermissions: Record<Role, readonly Permission[]> = {
  [ROLE.EDITOR]: [
    PERMISSION.EDIT_COMPOSITIONS,
    PERMISSION.EDIT_RAGAS,
    PERMISSION.EDIT_TALAS,
    PERMISSION.EDIT_ARTISTS,
  ],
  [ROLE.MODERATOR]: [
    PERMISSION.EDIT_COMPOSITIONS,
    PERMISSION.EDIT_RAGAS,
    PERMISSION.EDIT_TALAS,
    PERMISSION.EDIT_ARTISTS,
    PERMISSION.ROLLBACK_CHANGES,
    PERMISSION.PROTECT_ENTITY,
    PERMISSION.VIEW_IP_ADDRESSES,
  ],
  [ROLE.ADMIN]: [
    PERMISSION.EDIT_COMPOSITIONS,
    PERMISSION.EDIT_RAGAS,
    PERMISSION.EDIT_TALAS,
    PERMISSION.EDIT_ARTISTS,
    PERMISSION.ROLLBACK_CHANGES,
    PERMISSION.PROTECT_ENTITY,
    PERMISSION.VIEW_IP_ADDRESSES,
    PERMISSION.MANAGE_USERS,
    PERMISSION.MANAGE_ROLES,
  ],
};

/**
 * Check if a user with given role has a specific permission
 * @param role - User's role
 * @param permission - Permission to check
 * @returns true if role has the permission
 */
export function can(role: Role, permission: Permission): boolean {
  const perms = rolePermissions[role];
  return perms.includes(permission);
}
```

### tRPC Middleware (Updated)

**File:** `packages/trpc/src/middleware/auth.ts`

```typescript
import { TRPCError } from '@trpc/server';
import type { User } from '@rasika/core';
import { can, ROLE } from '@rasika/core';
import type { Context } from '../trpc';

export type AuthenticatedContext = Context & {
  user: NonNullable<Context['user']>;
};

/**
 * Middleware to ensure user is authenticated
 */
export const isAuthed = (isAuthed as any).async(async function ({
  ctx,
  next,
}: {
  ctx: Context;
  next: (input: { ctx: AuthenticatedContext }) => Promise<unknown>;
}) {
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in to access this resource',
    });
  }

  return next({ ctx: ctx as AuthenticatedContext });
});

/**
 * Middleware factory for permission checking
 * @param permission - Required permission string
 */
export function requirePermission(permission: Permission) {
  return (requirePermission as any).async(async function ({
    ctx,
    next,
  }: {
    ctx: Context;
    next: (input: { ctx: AuthenticatedContext }) => Promise<unknown>;
  }) {
    if (!ctx.user) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'You must be logged in to access this resource',
      });
    }

    const role = ctx.user.role as Role;

    if (!can(role, permission)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `You do not have permission to ${permission}`,
      });
    }

    return next({ ctx: ctx as AuthenticatedContext });
  });
}

/**
 * Middleware factory for single role checking
 * @param role - Required role
 */
export function requireRole(role: Role) {
  return (requireRole as any).async(async function ({
    ctx,
    next,
  }: {
    ctx: Context;
    next: (input: { ctx: AuthenticatedContext }) => Promise<unknown>;
  }) {
    if (!ctx.user) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'You must be logged in to access this resource',
      });
    }

    const userRole = ctx.user.role as Role;

    // Admin bypass - admins can access any role-protected route
    if (userRole !== role && userRole !== ROLE.ADMIN) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `${role} role required`,
      });
    }

    return next({ ctx: ctx as AuthenticatedContext });
  });
}
```

### ChangeHistory Service

**File:** `packages/core/src/domain/change-history/service.ts`

```typescript
import { ApplicationError, ErrorCode } from '@rasika/core';
import type { ChangeHistoryInput } from './types';
import { ChangeHistoryEntity } from './entity';
import { generateId } from '../../utils';
import type { ChangeHistory } from './entity';
import type { ChangeEntityType } from './types';

export type { ChangeHistory };

export async function createChangeHistory(input: ChangeHistoryInput): Promise<ChangeHistory> {
  const result = await ChangeHistoryEntity.create({
    id: generateId(),
    ...input,
    timestamp: Date.now(),
  }).go();

  if (!result.data) {
    throw new ApplicationError(
      ErrorCode.DATABASE_ERROR,
      'Failed to create change history entry'
    );
  }

  return result.data;
}

export async function getChangeHistory(
  entityType: ChangeEntityType,
  entityId: string,
  params?: { limit?: number; nextToken?: string }
): Promise<{
  items: ChangeHistory[];
  nextToken?: string;
  hasMore: boolean;
}> {
  const limit = params?.limit || 50;

  const result = await ChangeHistoryEntity.query
    .primary({ entityType, entityId })
    .go({
      limit,
      cursor: params?.nextToken,
      order: 'desc',
    });

  return {
    items: result.data || [],
    nextToken: result.cursor || undefined,
    hasMore: !!result.cursor,
  };
}

export async function getChangeHistoryById(id: string): Promise<ChangeHistory | null> {
  const result = await ChangeHistoryEntity.get({ id }).go();
  return result.data || null;
}

export async function getUserChanges(
  userId: string,
  params?: { limit?: number; nextToken?: string }
): Promise<{
  items: ChangeHistory[];
  nextToken?: string;
  hasMore: boolean;
}> {
  const limit = params?.limit || 50;

  const result = await ChangeHistoryEntity.query.byUser({ userId }).go({
    limit,
    cursor: params?.nextToken,
    order: 'desc',
  });

  return {
    items: result.data || [],
    nextToken: result.cursor || undefined,
    hasMore: !!result.cursor,
  };
}

export async function getEntityStateAtTimestamp(
  entityType: ChangeEntityType,
  entityId: string,
  targetTimestamp: number
): Promise<{ change: ChangeHistory; stateBefore: Record<string, unknown> } | null> {
  const result = await ChangeHistoryEntity.query
    .primary({ entityType, entityId })
    .go({ limit: 1000, order: 'desc' });

  const changes = result.data || [];
  const relevantChanges = changes.filter(c => c.timestamp <= targetTimestamp);

  if (relevantChanges.length === 0) {
    return null;
  }

  const targetChange = relevantChanges[relevantChanges.length - 1];

  let state: Record<string, unknown> = {};

  for (const change of relevantChanges) {
    if (change.action === 'update') {
      state = { ...state, ...change.diff };
    }
  }

  return { change: targetChange, stateBefore: state };
}
```

#### Rollback Strategy

**Key Decision:** Rollback creates a NEW history entry with `action='rollback'`. The entity is updated with values from the target change. This preserves the audit trail.

```typescript
/**
 * Rollback an entity to a previous state.
 */
export async function rollbackChange(
  entityType: ChangeEntityType,
  entityId: string,
  targetTimestamp: number,
  userId: string,
  comment?: string
): Promise<void> {
  const stateResult = await getEntityStateAtTimestamp(entityType, entityId, targetTimestamp);

  if (!stateResult) {
    throw new ApplicationError(
      ErrorCode.NOT_FOUND,
      `No change history found for ${entityType} ${entityId} at timestamp ${targetTimestamp}`
    );
  }

  const { stateBefore } = stateResult;

  // TODO: Call the appropriate entity service to update the entity
  // For example: await updateComposition(entityId, stateBefore, userId);

  // Record the rollback action in history
  await createChangeHistory({
    entityType,
    entityId,
    userId,
    action: 'rollback',
    diff: stateBefore,
    comment: comment || `Rolled back to state at ${new Date(targetTimestamp).toISOString()}`,
  });
}
```

### User Schema Update

**File:** `packages/core/src/domain/user/schema.ts`

```typescript
import { z } from 'zod';
import { ROLE } from '../../auth/roles';

export const CreateUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().min(1).max(100),
  picture: z.string().url().optional(),
  googleId: z.string(),
  role: z.nativeEnum(ROLE).default(ROLE.EDITOR),
});

export const UpdateUserSchema = CreateUserSchema.partial().extend({
  lastSignedInAt: z.string().optional(),
  role: z.nativeEnum(ROLE).optional(),
});

export const UpdateUserRoleSchema = z.object({
  role: z.nativeEnum(ROLE),
});
```

### User Service Update

**File:** `packages/core/src/domain/user/service.ts`

Add new function for role management:

```typescript
// ... existing exports and functions

export async function updateUserRole(
  id: string,
  role: (typeof ROLE)[keyof typeof ROLE]
): Promise<User> {
  const result = await UserEntity.update({ id })
    .set({ role })
    .go();

  if (!result.data) {
    throw new ApplicationError(ErrorCode.USER_NOT_FOUND, `User with ID ${id} not found`);
  }

  return result.data as User;
}

// Export the updated schema
export { CreateUserSchema, UpdateUserSchema, UpdateUserRoleSchema } from './schema';
```

### Remix Utilities

**File:** `packages/web/src/utils/auth.server.ts`

```typescript
import { redirect } from '@remix-run/node';
import { getSession, commitSession, destroySession } from '~/sessions.server';
import { can, ROLE } from '@rasika/core';
import type { User } from '@rasika/core';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
  role: (typeof ROLE)[keyof typeof ROLE];
}

type SessionData = {
  user: SessionUser;
};

type SessionFlashData = {
  error: string;
  success: string;
};

const sessionStorage = createCookieSessionStorage<SessionData, SessionFlashData>({
  cookie: {
    name: '__session',
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
    sameSite: 'lax',
    secrets: [process.env.SESSION_SECRET || 'default-secret'],
    secure: process.env.NODE_ENV === 'production',
  },
});

export async function getSession(request: Request) {
  return sessionStorage.getSession(request.headers.get('Cookie'));
}

export async function commitSession(session: ReturnType<typeof sessionStorage.getSession>) {
  return sessionStorage.commitSession(session);
}

export async function destroySessionFunc(session: ReturnType<typeof sessionStorage.getSession>) {
  return sessionStorage.destroySession(session);
}

export async function getUser(request: Request): Promise<SessionUser | null> {
  const session = await getSession(request);
  const user = session.get('user');
  return user || null;
}

export async function requireUser(request: Request, redirectTo: string = '/login') {
  const user = await getUser(request);

  if (!user) {
    const searchParams = new URLSearchParams([['redirectTo', redirectTo]]);
    throw redirect(`/login?${searchParams}`);
  }

  return user;
}

export async function requirePermission(
  request: Request,
  permission: string,
  redirectTo: string = '/unauthorized'
) {
  const user = await requireUser(request);

  if (!can(user.role, permission)) {
    throw redirect(redirectTo);
  }

  return user;
}

export async function requireRole(
  request: Request,
  role: (typeof ROLE)[keyof typeof ROLE],
  redirectTo: string = '/unauthorized'
) {
  const user = await requireUser(request);

  // Admin bypass
  if (user.role !== role && user.role !== ROLE.ADMIN) {
    throw redirect(redirectTo);
  }

  return user;
}

export async function createUserSession({
  request,
  user,
  remember = false,
  redirectTo,
}: {
  request: Request;
  user: User;
  remember?: boolean;
  redirectTo: string;
}) {
  const session = await getSession(request);
  session.set('user', {
    id: user.id,
    email: user.email,
    name: user.name,
    picture: user.picture,
    role: user.role,
  });

  return redirect(redirectTo, {
    headers: {
      'Set-Cookie': await sessionStorage.commitSession(session, {
        maxAge: remember ? 60 * 60 * 24 * 7 : undefined,
      }),
    },
  });
}

export async function logout(request: Request) {
  const session = await getSession(request);
  return redirect('/', {
    headers: {
      'Set-Cookie': await sessionStorage.destroySession(session),
    },
  });
}
```

---

## Infrastructure

### SST Stack Update

**File:** `stacks/MyStack.ts`

```typescript
import { Auth } from 'sst/constructs';
import { Api } from 'sst/constructs';

declare module 'sst/node/auth' {
  export interface SessionTypes {
    user: {
      userId: string;
      email: string;
      name: string;
      picture?: string;
      role: string;
    };
  }
}
```

---

## Implementation Plan

### Phase 1: Core Foundation

1. **Update roles.ts** - Define ROLE constants, PERMISSION constants, rolePermissions map, and can() function (single role)
2. **Update User entity** - Change `roles: Role[]` to `role: Role` with default ROLE.EDITOR
3. **Update User schema** - Change array validation to single role validation
4. **Update User service** - Change updateRoles() to updateRole() with single role parameter

### Phase 2: Change History System

1. **Update ChangeHistory types** - Change diff to store only changed fields, remove userName, update entity types to raga/tala/artist
2. **Update ChangeHistory entity** - Simplified schema with 2 indexes (primary, byUser)
3. **Update ChangeHistory service** - CRUD operations with new diff format
4. **Implement rollbackChange()** - Function to rollback entity to previous state

### Phase 3: tRPC Updates

1. **Update tRPC context** - Ensure user type includes single role
2. **Update auth middleware** - Change requireRoles() to requireRole() with admin bypass
3. **Update protectedProcedure** - Ensure compatibility with single role

### Phase 4: Remix Updates

1. **Update sessions.server.ts** - Include single role in session storage
2. **Simplify auth utilities** - Update requireRoles() to requireRole() with admin bypass
3. **Update route loaders** - Use new auth utilities

### Phase 5: Admin UI

1. **Create admin seed script** - Script to promote initial users to admin
2. **Create admin routes** - Minimal admin UI for role management at `/admin/users`
3. **Create history viewer** - UI to view entity change history
4. **Create rollback functionality** - Admin UI to rollback changes

---

## Testing Strategy

### Unit Tests

1. **can() function tests**
   - Editor permissions (edit_compositions, edit_ragas, edit_talas, edit_artists only)
   - Moderator permissions (adds rollback_changes, protect_entity, view_ip_addresses)
   - Admin explicit permissions (adds manage_users, manage_roles)

2. **User service tests**
   - Role updates
   - Role validation

3. **ChangeHistory service tests**
   - Create history entry with partial diff
   - Query by entity (composition/raga/tala/artist)
   - Query by user
   - Get entity state at timestamp

### Integration Tests

1. **tRPC middleware tests**
   - Protected procedure rejects unauthenticated
   - requirePermission blocks unauthorized
   - requireRole validates correctly
   - Admin bypass works

2. **Remix utilities tests**
   - requireUser redirects properly
   - can() works with session user role
   - Session includes role

---

## MIGRATION PATH: Single Role → Multi-Role

When multi-role support is needed, migrate:

### 1. Add new roles field

```typescript
roles: {
  type: 'list',
  items: { type: 'string', enum: Object.values(ROLE) },
  required: true,
  default: () => [user.role],  // migrate existing role to array
}
```

### 2. Update can() function

```typescript
export function can(roles: Role[], permission: string): boolean {
  return roles.some(role => {
    const perms = rolePermissions[role];
    return perms.includes(permission);
  });
}
```

### 3. Update all callers

- Replace `user.role` checks with `user.roles`
- Replace `role ===` checks with `roles.includes()`
- Update tRPC middleware to use `.some()` over roles
- Update Remix utilities to use array methods

### Estimated Effort

~2-4 hours of straightforward changes:

1. Add migration for existing users (batch update)
2. Update entity schema
3. Update can() function
4. Update tRPC middleware
5. Update Remix utilities
6. Update all direct checks

The migration is safe because:
- Admin bypass still works with `roles.includes(ROLE.ADMIN)`
- All existing permission checks remain valid
- No changes to rolePermissions required

---

## Open Questions

1. **Diff storage format**: Is storing only changed fields sufficient for rollback?
   - Current: `{ "title": "Old Title" }`
   - Alternative: Store full before/after for complete snapshot
   - Decision: Start with partial diff, can migrate if needed

2. **User name lookup**: When viewing history, should we join with User table?
   - Current: History shows only userId
   - Alternative: Store userName snapshot
   - Decision: Fetch user names on display - cleaner data model

3. **Rollback of rollback**: Can we rollback a rollback?
   - Current: Yes, rollback creates a new entry
   - Decision: Allow it - audit trail should show all actions

4. **IP address tracking**: Do we need to store IP addresses?
   - Current: Permission exists ('view_ip_addresses')
   - Decision: Defer - add when needed with proper retention policy

5. **Granular edit permissions**: Should editors be able to edit all entity types or just some?
   - Current: Editors can edit all (compositions, ragas, talas, artists)
   - Alternative: Different permissions per entity type
   - Decision: Start simple - one permission per entity type, all included in EDITOR role
