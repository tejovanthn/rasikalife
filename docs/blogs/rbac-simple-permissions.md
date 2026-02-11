# RBAC with Simple Permissions - Scalable Authorization

## Introduction

Authorization is a critical component of any multi-user application, determining what actions users can perform. Role-Based Access Control (RBAC) provides a scalable approach by grouping permissions into roles and assigning roles to users. This blog post explores our RBAC implementation for the Rasika.life platform, covering role definitions, permission checking, middleware integration, and best practices for maintainable authorization systems.

## The Authorization Challenge

### Requirements
- **Hierarchical roles**: Editor < Moderator < Admin with increasing privileges
- **Permission-based access**: Granular control over specific operations
- **Type safety**: Compile-time checking of roles and permissions
- **Easy maintenance**: Simple to add new roles or permissions
- **Performance**: Fast permission checks without database queries
- **Integration**: Seamless integration with tRPC and API layer

### Traditional Approaches and Limitations

```typescript
// Naive approach - hardcoded checks
export async function deleteArtist(userId: string, artistId: string) {
  const user = await getUser(userId);

  // Brittle permission checks scattered throughout codebase
  if (user.email === 'admin@example.com') {
    await Artist.delete(artistId);
  } else {
    throw new Error('Not authorized');
  }
}

// Problems:
// - No role abstraction
// - Repeated authorization logic
// - Difficult to maintain
// - No type safety
// - Hard to audit permissions
```

## RBAC Architecture

### Role and Permission Definitions

```typescript
// packages/core/src/auth/roles.ts
export const ROLE = {
  EDITOR: 'editor',
  MODERATOR: 'moderator',
  ADMIN: 'admin',
} as const;

export type Role = (typeof ROLE)[keyof typeof ROLE];

export const PERMISSION = {
  // Content editing permissions
  EDIT_COMPOSITIONS: 'edit_compositions',
  EDIT_RAGAS: 'edit_ragas',
  EDIT_TALAS: 'edit_talas',
  EDIT_ARTISTS: 'edit_artists',

  // Moderation permissions
  ROLLBACK_CHANGES: 'rollback_changes',
  PROTECT_ENTITY: 'protect_entity',
  VIEW_IP_ADDRESSES: 'view_ip_addresses',

  // Administration permissions
  MANAGE_USERS: 'manage_users',
  MANAGE_ROLES: 'manage_roles',
} as const;

export type Permission = (typeof PERMISSION)[keyof typeof PERMISSION];
```

### Role-Permission Mapping

```typescript
// Map roles to their permissions
export const rolePermissions: Record<Role, readonly Permission[]> = {
  [ROLE.EDITOR]: [
    PERMISSION.EDIT_COMPOSITIONS,
    PERMISSION.EDIT_RAGAS,
    PERMISSION.EDIT_TALAS,
    PERMISSION.EDIT_ARTISTS,
  ],
  [ROLE.MODERATOR]: [
    // Moderators have all editor permissions
    PERMISSION.EDIT_COMPOSITIONS,
    PERMISSION.EDIT_RAGAS,
    PERMISSION.EDIT_TALAS,
    PERMISSION.EDIT_ARTISTS,
    // Plus moderation permissions
    PERMISSION.ROLLBACK_CHANGES,
    PERMISSION.PROTECT_ENTITY,
    PERMISSION.VIEW_IP_ADDRESSES,
  ],
  [ROLE.ADMIN]: [
    // Admins have all permissions
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

### Permission Checking Function

```typescript
// Simple, fast permission check
export function can(role: Role, permission: Permission): boolean {
  const permissions = rolePermissions[role];
  return permissions.includes(permission);
}

// Usage examples
const userRole: Role = ROLE.EDITOR;

if (can(userRole, PERMISSION.EDIT_ARTISTS)) {
  // User can edit artists
}

if (can(userRole, PERMISSION.MANAGE_USERS)) {
  // This will be false for EDITOR role
}
```

## User Subject Definition

### OpenAuth Integration

```typescript
// packages/core/src/auth/subjects.ts
import { createSubjects } from '@openauthjs/openauth/subject';
import { z } from 'zod';

/**
 * Shared OpenAuth subjects schema
 * Used by both the issuer and client for token verification
 */
export const subjects = createSubjects({
  user: z.object({
    userID: z.string(),
  }),
});

export type Subjects = typeof subjects;
```

### User Entity with Role

```typescript
// packages/core/src/domain/user/types.ts
export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Default role for new users
export const DEFAULT_ROLE: Role = ROLE.EDITOR;
```

## tRPC Middleware Integration

### Base Authentication Middleware

```typescript
// packages/trpc/src/trpc.ts
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in to access this resource',
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user, // Type narrowing - user is now non-null
    },
  });
});
```

### Admin-Only Middleware

```typescript
export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in',
    });
  }

  if (ctx.user.role !== ROLE.ADMIN) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Admin access required',
    });
  }

  return next({ ctx });
});
```

### Moderator Middleware

```typescript
export const moderatorProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in',
    });
  }

  // Allow both moderators and admins
  const moderatorRoles: Role[] = [ROLE.MODERATOR, ROLE.ADMIN];

  if (!moderatorRoles.includes(ctx.user.role as Role)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Moderator access required',
    });
  }

  return next({ ctx });
});
```

### Permission-Based Middleware

```typescript
import { can, type Permission } from '@rasika/core';

// Generic permission checker middleware
export const requirePermission = (permission: Permission) => {
  return protectedProcedure.use(async ({ ctx, next }) => {
    if (!can(ctx.user.role as Role, permission)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `This operation requires ${permission} permission`,
      });
    }

    return next({ ctx });
  });
};

// Usage in routers
export const artistRouter = router({
  protect: requirePermission(PERMISSION.PROTECT_ENTITY)
    .input(z.object({ artistId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      return await Artist.protect(input.artistId);
    }),
});
```

## Router Examples

### User Management Router (Admin Only)

```typescript
// packages/trpc/src/routers/user.ts
import { z } from 'zod';
import { User } from '@rasika/core';
import { adminProcedure, protectedProcedure, router } from '../trpc';
import { ROLE } from '../../core/src/auth/roles';

export const userRouter = router({
  // Any authenticated user can get their own profile
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    return await User.getUser(ctx.user.id);
  }),

  // Only admins can list all users
  listUsers: adminProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).optional(),
        nextToken: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      return await User.listUsers(input);
    }),

  // Only admins can update user roles
  updateUserRole: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        role: z.enum([ROLE.EDITOR, ROLE.MODERATOR, ROLE.ADMIN]),
      })
    )
    .mutation(async ({ input }) => {
      return await User.updateUserRole(input.userId, input.role);
    }),

  // Only admins can deactivate users
  deactivateUser: adminProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ input }) => {
      return await User.deactivateUser(input.userId);
    }),
});
```

### Edit Moderation Router

```typescript
// packages/trpc/src/routers/edit.ts
export const editRouter = router({
  // Any authenticated user can create drafts
  createDraft: protectedProcedure
    .input(CreateEditSchema)
    .mutation(async ({ input, ctx }) => {
      return await Edit.createDraft({
        ...input,
        userId: ctx.user.id,
      });
    }),

  // Any authenticated user can view their own edits
  getUserEdits: protectedProcedure
    .input(PaginationSchema)
    .query(async ({ input, ctx }) => {
      return await Edit.getUserEdits(ctx.user.id, input);
    }),

  // Only moderators can view pending edits
  getPendingEdits: moderatorProcedure
    .input(PendingEditsSchema)
    .query(async ({ input }) => {
      return await Edit.getPendingEdits(input);
    }),

  // Only moderators can approve edits
  approveEdit: moderatorProcedure
    .input(z.object({ editId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      return await Edit.approveEdit(input.editId, ctx.user.id);
    }),

  // Only moderators can reject edits
  rejectEdit: moderatorProcedure
    .input(
      z.object({
        editId: z.string(),
        moderatorNote: z.string().min(10),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return await Edit.rejectEdit(input.editId, ctx.user.id, input.moderatorNote);
    }),
});
```

## Domain-Level Authorization

### Service-Level Permission Checks

```typescript
// packages/core/src/domain/artist/service.ts
import { can, PERMISSION, type Role } from '../../auth/roles';

export async function protectArtist(
  artistId: string,
  userId: string,
  userRole: Role
): Promise<Artist> {
  // Check permission at service level
  if (!can(userRole, PERMISSION.PROTECT_ENTITY)) {
    throw new ApplicationError(
      ErrorCode.AUTHORIZATION_ERROR,
      'You do not have permission to protect entities'
    );
  }

  // Verify artist exists
  const artist = await getArtist(artistId);
  if (!artist) {
    throw notFoundError('artist', artistId);
  }

  // Update protection status
  return await updateArtist(artistId, { isProtected: true });
}
```

### Resource Ownership Checks

```typescript
// Combine role and ownership checks
export async function deleteEdit(
  editId: string,
  userId: string,
  userRole: Role
): Promise<void> {
  const edit = await getEdit(editId);

  if (!edit) {
    throw notFoundError('edit', editId);
  }

  // Users can delete their own drafts
  const isOwner = edit.userId === userId;
  const isDraft = edit.status === EditStatus.DRAFT;

  // Admins can delete any edit
  const isAdmin = userRole === ROLE.ADMIN;

  if (!isAdmin && !(isOwner && isDraft)) {
    throw new ApplicationError(
      ErrorCode.AUTHORIZATION_ERROR,
      'You can only delete your own draft edits'
    );
  }

  await EditEntity.delete({ id: editId }).go();
}
```

## Frontend Authorization

### Role-Based UI Rendering

```tsx
// packages/web/app/components/EntityActions.tsx
import { useUser } from '~/hooks/useUser';
import { can, PERMISSION } from '@rasika/core';

export function EntityActions({ entityId }: { entityId: string }) {
  const user = useUser();

  const canProtect = user && can(user.role, PERMISSION.PROTECT_ENTITY);
  const canManageUsers = user && can(user.role, PERMISSION.MANAGE_USERS);

  return (
    <div className="actions">
      {canProtect && (
        <button onClick={() => protectEntity(entityId)}>
          Protect Entity
        </button>
      )}

      {canManageUsers && (
        <Link to="/admin/users">
          Manage Users
        </Link>
      )}
    </div>
  );
}
```

### Route Protection

```tsx
// packages/web/app/routes/admin._index.tsx
import { redirect } from '@remix-run/node';
import { ROLE } from '@rasika/core';

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUserFromRequest(request);

  // Redirect non-admins
  if (!user || user.role !== ROLE.ADMIN) {
    throw redirect('/');
  }

  return json({ user });
}

export default function AdminDashboard() {
  const { user } = useLoaderData<typeof loader>();

  return (
    <div>
      <h1>Admin Dashboard</h1>
      <p>Welcome, {user.name}!</p>
    </div>
  );
}
```

## Advanced Patterns

### Dynamic Permission Checking

```typescript
// Check multiple permissions
export function hasAnyPermission(role: Role, permissions: Permission[]): boolean {
  return permissions.some(permission => can(role, permission));
}

export function hasAllPermissions(role: Role, permissions: Permission[]): boolean {
  return permissions.every(permission => can(role, permission));
}

// Usage
if (hasAnyPermission(userRole, [PERMISSION.MANAGE_USERS, PERMISSION.MANAGE_ROLES])) {
  // User can manage users OR roles
}

if (hasAllPermissions(userRole, [PERMISSION.EDIT_ARTISTS, PERMISSION.PROTECT_ENTITY])) {
  // User can both edit and protect artists
}
```

### Context-Based Authorization

```typescript
// Authorization based on entity context
export async function canEditEntity(
  userId: string,
  userRole: Role,
  entityType: string,
  entityId: string
): Promise<boolean> {
  // Check base permission
  const permissionMap: Record<string, Permission> = {
    artist: PERMISSION.EDIT_ARTISTS,
    composition: PERMISSION.EDIT_COMPOSITIONS,
    raga: PERMISSION.EDIT_RAGAS,
    tala: PERMISSION.EDIT_TALAS,
  };

  const requiredPermission = permissionMap[entityType];
  if (!can(userRole, requiredPermission)) {
    return false;
  }

  // Check if entity is protected
  const entity = await getEntity(entityType, entityId);
  if (entity?.isProtected && userRole !== ROLE.ADMIN) {
    return false;
  }

  return true;
}
```

### Audit Logging

```typescript
// Log permission checks for security audit
export function canWithAudit(
  userId: string,
  role: Role,
  permission: Permission,
  context?: Record<string, unknown>
): boolean {
  const result = can(role, permission);

  // Log the check
  console.log({
    type: 'permission_check',
    userId,
    role,
    permission,
    result,
    context,
    timestamp: new Date().toISOString(),
  });

  return result;
}
```

## Testing Authorization

### Unit Tests

```typescript
import { describe, it, expect } from 'vitest';
import { can, ROLE, PERMISSION } from '@rasika/core';

describe('RBAC', () => {
  describe('Editor role', () => {
    it('should allow editing content', () => {
      expect(can(ROLE.EDITOR, PERMISSION.EDIT_ARTISTS)).toBe(true);
      expect(can(ROLE.EDITOR, PERMISSION.EDIT_COMPOSITIONS)).toBe(true);
    });

    it('should not allow moderation', () => {
      expect(can(ROLE.EDITOR, PERMISSION.ROLLBACK_CHANGES)).toBe(false);
      expect(can(ROLE.EDITOR, PERMISSION.PROTECT_ENTITY)).toBe(false);
    });

    it('should not allow administration', () => {
      expect(can(ROLE.EDITOR, PERMISSION.MANAGE_USERS)).toBe(false);
    });
  });

  describe('Moderator role', () => {
    it('should have all editor permissions', () => {
      expect(can(ROLE.MODERATOR, PERMISSION.EDIT_ARTISTS)).toBe(true);
    });

    it('should allow moderation', () => {
      expect(can(ROLE.MODERATOR, PERMISSION.ROLLBACK_CHANGES)).toBe(true);
      expect(can(ROLE.MODERATOR, PERMISSION.PROTECT_ENTITY)).toBe(true);
    });

    it('should not allow administration', () => {
      expect(can(ROLE.MODERATOR, PERMISSION.MANAGE_USERS)).toBe(false);
    });
  });

  describe('Admin role', () => {
    it('should have all permissions', () => {
      const allPermissions = Object.values(PERMISSION);
      allPermissions.forEach(permission => {
        expect(can(ROLE.ADMIN, permission)).toBe(true);
      });
    });
  });
});
```

### Integration Tests

```typescript
describe('tRPC Authorization', () => {
  it('should allow admins to update roles', async () => {
    const caller = createCaller({
      event: {} as any,
      user: { id: 'admin-1', role: ROLE.ADMIN },
    });

    const result = await caller.user.updateUserRole({
      userId: 'user-1',
      role: ROLE.MODERATOR,
    });

    expect(result.role).toBe(ROLE.MODERATOR);
  });

  it('should reject non-admins from updating roles', async () => {
    const caller = createCaller({
      event: {} as any,
      user: { id: 'editor-1', role: ROLE.EDITOR },
    });

    await expect(
      caller.user.updateUserRole({
        userId: 'user-1',
        role: ROLE.MODERATOR,
      })
    ).rejects.toThrow('FORBIDDEN');
  });
});
```

## Best Practices

### 1. Centralized Permission Definitions
- Define all roles and permissions in a single module
- Export typed constants for compile-time safety
- Document each permission's purpose

### 2. Layered Authorization
- Check permissions at multiple layers (middleware, service, domain)
- Don't rely solely on frontend checks
- Use middleware for API-level checks
- Use service-level checks for business logic

### 3. Principle of Least Privilege
- Assign minimum necessary permissions
- Start with restrictive roles and expand as needed
- Regularly audit role-permission mappings

### 4. Clear Role Hierarchy
- Define clear progression: Editor → Moderator → Admin
- Higher roles inherit lower role permissions
- Document role responsibilities

### 5. Separate Authentication from Authorization
- Authentication: Who are you? (handled by OpenAuth)
- Authorization: What can you do? (handled by RBAC)

## Common Pitfalls

### 1. Frontend-Only Checks
**Problem**: Checking permissions only in UI

```typescript
// Wrong - no backend enforcement
if (user.role === 'admin') {
  <button onClick={() => deleteUser(userId)}>Delete</button>
}
```

**Solution**: Always enforce on backend

```typescript
// Correct - enforce in API
export const deleteUser = adminProcedure
  .input(z.object({ userId: z.string() }))
  .mutation(async ({ input }) => {
    await User.delete(input.userId);
  });
```

### 2. Hardcoded Permission Checks
**Problem**: Scattered permission logic

```typescript
// Wrong - hardcoded checks everywhere
if (user.role === 'admin' || user.role === 'moderator') {
  // Allow action
}
```

**Solution**: Use centralized permission function

```typescript
// Correct - use permission abstraction
if (can(user.role, PERMISSION.MODERATE_CONTENT)) {
  // Allow action
}
```

### 3. Role String Comparison
**Problem**: Using strings instead of typed constants

```typescript
// Wrong - typo-prone
if (user.role === 'admim') { // typo!
  // Never executed
}
```

**Solution**: Use typed role constants

```typescript
// Correct - type-safe
if (user.role === ROLE.ADMIN) {
  // Type-checked
}
```

## Conclusion

A well-designed RBAC system provides scalable, maintainable authorization for multi-user applications. By centralizing role and permission definitions, implementing layered checks, and integrating with your API layer, you can build secure applications that grow with your needs.

For the Rasika.life platform, this simple yet effective RBAC implementation enables clear role progression from contributors (editors) to moderators to administrators, ensuring content quality while encouraging community participation.

## Resources

- [NIST RBAC Standard](https://csrc.nist.gov/projects/role-based-access-control)
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- [Role-Based Access Control Patterns](https://martinfowler.com/articles/role-based-access-control.html)
- [OpenAuth Documentation](https://openauth.js.org/)
