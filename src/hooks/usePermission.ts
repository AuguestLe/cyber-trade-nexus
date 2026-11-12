import { useAuthStore } from '@/store/authStore';
import { can, type Capability } from '@/lib/permission';
import type { User } from '@/types';

export interface PermissionApi {
  user: User | null;
  isAdmin: boolean;
  can(capability: Capability): boolean;
}

/** 组件级权限：与路由守卫、服务端角色校验形成三层防护。 */
export function usePermission(): PermissionApi {
  const user = useAuthStore((state) => state.user);
  return {
    user,
    isAdmin: Boolean(user?.enabled && user.role === 'admin'),
    can: (capability) => can(user, capability),
  };
}
