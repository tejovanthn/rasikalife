# RBAC System Implementation

## Introduction

The Rasika.life platform implements Role-Based Access Control (RBAC) for managing user permissions. This document covers the RBAC implementation patterns.

## Role Definitions

```typescript
export const ROLE = {
  EDITOR: 'editor',
  MODERATOR: 'moderator',
  ADMIN: 'admin',
} as const;

export type Role = (typeof ROLE)[keyof typeof ROLE];
```

## Permission Definitions

```typescript
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
```

## Role-Permission Mapping

```typescript
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

## Permission Checking

```typescript
export function can(role: Role, permission: Permission): boolean {
  const perms = rolePermissions[role];
  return perms.includes(permission);
}
```

## User Entity with Role

```typescript
export const UserEntity = new Entity(
  {
    model: {
      entity: 'user',
      version: '2',
      service: 'rasikalife',
    },
    attributes: {
      id: { type: 'string', required: true },
      email: { type: 'string', required: true },
      name: { type: 'string', required: true },
      picture: { type: 'string', required: false },
      googleId: { type: 'string', required: true },
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
        pk: { field: 'pk', composite: ['id'], template: 'USER#${id}' },
        sk: { field: 'sk', composite: [], template: '#METADATA' },
      },
      byEmail: {
        index: 'gsi1',
        pk: { field: 'gsi1pk', composite: ['email'], template: 'USER_EMAIL#${email}' },
        sk: { field: 'gsi1sk', composite: ['id'], template: 'USER#${id}' },
      },
      byGoogleId: {
        index: 'gsi2',
        pk: { field: 'gsi2pk', composite: ['googleId'], template: 'USER_GOOGLE_ID#${googleId}' },
        sk: { field: 'gsi2sk', composite: ['id'], template: 'USER#${id}' },
      },
    },
  },
  { client: dynamoClient, table: process.env.DYNAMODB_TABLE || 'RasikaLifeTable' }
);
```

## Best Practices

### 1. Minimal Roles
Start with minimal roles and add as needed.

### 2. Clear Permissions
Keep permissions clear and specific.

### 3. Default to Least Privilege
Default new users to the EDITOR role.

### 4. Audit Logging
Log permission changes for security.

## Usage Example

```typescript
import { ROLE, PERMISSION, can } from './roles';

const userRole = ROLE.MODERATOR;

if (can(userRole, PERMISSION.ROLLBACK_CHANGES)) {
  // User can rollback changes
}

if (can(userRole, PERMISSION.MANAGE_ROLES)) {
  // User can manage roles
}
```

## Conclusion

The RBAC system provides a simple, maintainable approach to access control. By keeping roles and permissions minimal and clear, we ensure secure and manageable access control.
