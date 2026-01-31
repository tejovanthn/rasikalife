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

export function can(role: Role, permission: Permission): boolean {
  const perms = rolePermissions[role];
  return perms.includes(permission);
}
