import { describe, expect, it } from 'vitest';
import { PERMISSION, ROLE, can, rolePermissions } from '../auth/roles';

describe('RBAC Roles', () => {
  it('should have all required roles defined', () => {
    expect(ROLE.EDITOR).toBe('editor');
    expect(ROLE.MODERATOR).toBe('moderator');
    expect(ROLE.ADMIN).toBe('admin');
  });

  it('should have all required permissions defined', () => {
    expect(PERMISSION.EDIT_COMPOSITIONS).toBe('edit_compositions');
    expect(PERMISSION.EDIT_RAGAS).toBe('edit_ragas');
    expect(PERMISSION.EDIT_TALAS).toBe('edit_talas');
    expect(PERMISSION.EDIT_ARTISTS).toBe('edit_artists');
    expect(PERMISSION.ROLLBACK_CHANGES).toBe('rollback_changes');
    expect(PERMISSION.PROTECT_ENTITY).toBe('protect_entity');
    expect(PERMISSION.VIEW_IP_ADDRESSES).toBe('view_ip_addresses');
    expect(PERMISSION.MANAGE_USERS).toBe('manage_users');
    expect(PERMISSION.MANAGE_ROLES).toBe('manage_roles');
  });
});

describe('can() permission function', () => {
  describe('EDITOR role', () => {
    it('should allow editing compositions', () => {
      expect(can(ROLE.EDITOR, PERMISSION.EDIT_COMPOSITIONS)).toBe(true);
    });

    it('should allow editing ragas', () => {
      expect(can(ROLE.EDITOR, PERMISSION.EDIT_RAGAS)).toBe(true);
    });

    it('should allow editing talas', () => {
      expect(can(ROLE.EDITOR, PERMISSION.EDIT_TALAS)).toBe(true);
    });

    it('should allow editing artists', () => {
      expect(can(ROLE.EDITOR, PERMISSION.EDIT_ARTISTS)).toBe(true);
    });

    it('should NOT allow rollback changes', () => {
      expect(can(ROLE.EDITOR, PERMISSION.ROLLBACK_CHANGES)).toBe(false);
    });

    it('should NOT allow protect entity', () => {
      expect(can(ROLE.EDITOR, PERMISSION.PROTECT_ENTITY)).toBe(false);
    });

    it('should NOT allow viewing IP addresses', () => {
      expect(can(ROLE.EDITOR, PERMISSION.VIEW_IP_ADDRESSES)).toBe(false);
    });

    it('should NOT allow managing users', () => {
      expect(can(ROLE.EDITOR, PERMISSION.MANAGE_USERS)).toBe(false);
    });

    it('should NOT allow managing roles', () => {
      expect(can(ROLE.EDITOR, PERMISSION.MANAGE_ROLES)).toBe(false);
    });
  });

  describe('MODERATOR role', () => {
    it('should allow editing compositions', () => {
      expect(can(ROLE.MODERATOR, PERMISSION.EDIT_COMPOSITIONS)).toBe(true);
    });

    it('should allow editing ragas', () => {
      expect(can(ROLE.MODERATOR, PERMISSION.EDIT_RAGAS)).toBe(true);
    });

    it('should allow editing talas', () => {
      expect(can(ROLE.MODERATOR, PERMISSION.EDIT_TALAS)).toBe(true);
    });

    it('should allow editing artists', () => {
      expect(can(ROLE.MODERATOR, PERMISSION.EDIT_ARTISTS)).toBe(true);
    });

    it('should allow rollback changes', () => {
      expect(can(ROLE.MODERATOR, PERMISSION.ROLLBACK_CHANGES)).toBe(true);
    });

    it('should allow protect entity', () => {
      expect(can(ROLE.MODERATOR, PERMISSION.PROTECT_ENTITY)).toBe(true);
    });

    it('should allow viewing IP addresses', () => {
      expect(can(ROLE.MODERATOR, PERMISSION.VIEW_IP_ADDRESSES)).toBe(true);
    });

    it('should NOT allow managing users', () => {
      expect(can(ROLE.MODERATOR, PERMISSION.MANAGE_USERS)).toBe(false);
    });

    it('should NOT allow managing roles', () => {
      expect(can(ROLE.MODERATOR, PERMISSION.MANAGE_ROLES)).toBe(false);
    });
  });

  describe('ADMIN role', () => {
    it('should allow editing compositions', () => {
      expect(can(ROLE.ADMIN, PERMISSION.EDIT_COMPOSITIONS)).toBe(true);
    });

    it('should allow editing ragas', () => {
      expect(can(ROLE.ADMIN, PERMISSION.EDIT_RAGAS)).toBe(true);
    });

    it('should allow editing talas', () => {
      expect(can(ROLE.ADMIN, PERMISSION.EDIT_TALAS)).toBe(true);
    });

    it('should allow editing artists', () => {
      expect(can(ROLE.ADMIN, PERMISSION.EDIT_ARTISTS)).toBe(true);
    });

    it('should allow rollback changes', () => {
      expect(can(ROLE.ADMIN, PERMISSION.ROLLBACK_CHANGES)).toBe(true);
    });

    it('should allow protect entity', () => {
      expect(can(ROLE.ADMIN, PERMISSION.PROTECT_ENTITY)).toBe(true);
    });

    it('should allow viewing IP addresses', () => {
      expect(can(ROLE.ADMIN, PERMISSION.VIEW_IP_ADDRESSES)).toBe(true);
    });

    it('should allow managing users', () => {
      expect(can(ROLE.ADMIN, PERMISSION.MANAGE_USERS)).toBe(true);
    });

    it('should allow managing roles', () => {
      expect(can(ROLE.ADMIN, PERMISSION.MANAGE_ROLES)).toBe(true);
    });
  });

  describe('Role hierarchy checks', () => {
    it('editor should not have moderator permissions', () => {
      expect(can(ROLE.EDITOR, PERMISSION.ROLLBACK_CHANGES)).toBe(false);
    });

    it('moderator should not have admin permissions', () => {
      expect(can(ROLE.MODERATOR, PERMISSION.MANAGE_USERS)).toBe(false);
    });

    it('admin should have all permissions', () => {
      Object.values(PERMISSION).forEach(permission => {
        expect(can(ROLE.ADMIN, permission)).toBe(true);
      });
    });
  });
});

describe('rolePermissions map', () => {
  it('should define permissions for EDITOR role', () => {
    const editorPerms = rolePermissions[ROLE.EDITOR];
    expect(editorPerms).toContain(PERMISSION.EDIT_COMPOSITIONS);
    expect(editorPerms).toContain(PERMISSION.EDIT_RAGAS);
    expect(editorPerms).toContain(PERMISSION.EDIT_TALAS);
    expect(editorPerms).toContain(PERMISSION.EDIT_ARTISTS);
    expect(editorPerms.length).toBe(4);
  });

  it('should define permissions for MODERATOR role', () => {
    const modPerms = rolePermissions[ROLE.MODERATOR];
    expect(modPerms).toContain(PERMISSION.EDIT_COMPOSITIONS);
    expect(modPerms).toContain(PERMISSION.EDIT_RAGAS);
    expect(modPerms).toContain(PERMISSION.EDIT_TALAS);
    expect(modPerms).toContain(PERMISSION.EDIT_ARTISTS);
    expect(modPerms).toContain(PERMISSION.ROLLBACK_CHANGES);
    expect(modPerms).toContain(PERMISSION.PROTECT_ENTITY);
    expect(modPerms).toContain(PERMISSION.VIEW_IP_ADDRESSES);
    expect(modPerms.length).toBe(7);
  });

  it('should define permissions for ADMIN role', () => {
    const adminPerms = rolePermissions[ROLE.ADMIN];
    expect(adminPerms.length).toBe(9);
    Object.values(PERMISSION).forEach(permission => {
      expect(adminPerms).toContain(permission);
    });
  });
});
