import type { Role, User } from '@/types';

export type Capability =
  | 'view:dashboard'
  | 'view:map'
  | 'view:trades'
  | 'view:admin'
  | 'stream:control'
  | 'alert:handle'
  | 'mock:control'
  | 'user:manage'
  | 'settings:manage'
  | 'export:snapshot'
  | 'identity:switch';

const VIEWER_CAPABILITIES: Capability[] = ['view:dashboard', 'view:map', 'view:trades'];

const ADMIN_CAPABILITIES: Capability[] = [
  ...VIEWER_CAPABILITIES,
  'view:admin',
  'stream:control',
  'alert:handle',
  'mock:control',
  'user:manage',
  'settings:manage',
  'export:snapshot',
  'identity:switch',
];

export const ROLE_CAPABILITIES: Record<Role, Capability[]> = {
  admin: ADMIN_CAPABILITIES,
  viewer: VIEWER_CAPABILITIES,
};

export function hasCapability(role: Role | undefined | null, capability: Capability): boolean {
  if (!role) return false;
  return ROLE_CAPABILITIES[role].includes(capability);
}

export function can(user: User | null | undefined, capability: Capability): boolean {
  if (!user || !user.enabled) return false;
  return hasCapability(user.role, capability);
}

export function isAdmin(user: User | null | undefined): boolean {
  return Boolean(user?.enabled && user.role === 'admin');
}
