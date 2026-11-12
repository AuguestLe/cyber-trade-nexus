import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { usePermission } from '@/hooks/usePermission';
import { ForbiddenPage } from '@/pages/ForbiddenPage';

/** 路由守卫：未登录跳登录页并保留来源。 */
export function RequireAuth() {
  const token = useAuthStore((state) => state.token);
  const location = useLocation();
  if (!token) {
    const from = `${location.pathname}${location.search}`;
    return <Navigate to="/login" replace state={{ from }} />;
  }
  return <Outlet />;
}

/** 角色守卫：越权直接渲染 403，不重定向，保留可见的导航上下文。 */
export function RequireRole({ role, children }: { role: 'admin' | 'viewer'; children: ReactNode }) {
  const { isAdmin } = usePermission();
  if (role === 'admin' && !isAdmin) {
    return <ForbiddenPage />;
  }
  return <>{children}</>;
}
