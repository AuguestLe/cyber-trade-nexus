import { describe, expect, it } from 'vitest';
import { can, hasCapability, isAdmin, ROLE_CAPABILITIES } from '../permission';
import type { User } from '@/types';

const admin: User = {
  id: 'u_admin',
  username: 'admin',
  displayName: '系统管理员',
  role: 'admin',
  enabled: true,
  lastLoginAt: null,
};

const viewer: User = { ...admin, id: 'u_viewer', username: 'viewer', role: 'viewer' };

describe('权限矩阵', () => {
  it('admin 拥有全部能力', () => {
    expect(hasCapability('admin', 'view:admin')).toBe(true);
    expect(hasCapability('admin', 'mock:control')).toBe(true);
    expect(hasCapability('admin', 'alert:handle')).toBe(true);
    expect(hasCapability('admin', 'identity:switch')).toBe(true);
    expect(ROLE_CAPABILITIES.admin.length).toBeGreaterThan(ROLE_CAPABILITIES.viewer.length);
  });

  it('viewer 只有查看能力', () => {
    expect(can(viewer, 'view:dashboard')).toBe(true);
    expect(can(viewer, 'view:map')).toBe(true);
    expect(can(viewer, 'view:trades')).toBe(true);
    expect(can(viewer, 'view:admin')).toBe(false);
    expect(can(viewer, 'mock:control')).toBe(false);
    expect(can(viewer, 'alert:handle')).toBe(false);
    expect(can(viewer, 'identity:switch')).toBe(false);
  });

  it('停用账号与空用户不具备任何能力', () => {
    expect(can({ ...admin, enabled: false }, 'view:map')).toBe(false);
    expect(can(null, 'view:map')).toBe(false);
    expect(isAdmin(null)).toBe(false);
    expect(isAdmin(viewer)).toBe(false);
    expect(isAdmin({ ...admin, enabled: false })).toBe(false);
    expect(isAdmin(admin)).toBe(true);
  });
});
