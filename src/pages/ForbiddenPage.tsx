import { ShieldX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePermission } from '@/hooks/usePermission';
import { useAuthStore } from '@/store/authStore';
import { NeonButton } from '@/components/NeonButton';
import styles from '@/styles/forbidden.module.css';

export function ForbiddenPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const { isAdmin } = usePermission();

  return (
    <section className={styles.page}>
      <div className={styles.code}>ERR / 403 · ACCESS DENIED</div>
      <div className={styles.iconWrap}>
        <ShieldX size={44} className={styles.icon} />
      </div>
      <h1 className={styles.title}>访问被拒绝</h1>
      <p className={styles.desc}>
        当前账号「{user?.displayName ?? '未登录'}」的角色为{' '}
        <b>{user?.role === 'admin' ? 'ADMIN' : 'VIEWER'}</b>，该资源仅向管理员开放。
        演示系统不会记录此次越权尝试，但服务端仍会拒绝无权限的管理接口调用。
      </p>
      <div className={styles.meta}>
        <span>REQUIRED ROLE · ADMIN</span>
        <span>CURRENT ROLE · {(user?.role ?? 'GUEST').toUpperCase()}</span>
        <span>DEMO AUTH · NOT PRODUCTION</span>
      </div>
      <div className={styles.actions}>
        <NeonButton variant="primary" onClick={() => navigate('/')}>
          返回态势总览
        </NeonButton>
        {isAdmin && (
          <NeonButton variant="ghost" onClick={() => navigate('/admin')}>
            进入控制台
          </NeonButton>
        )}
        <NeonButton variant="ghost" onClick={() => navigate('/map')}>
          打开全球地图
        </NeonButton>
      </div>
      <div className={styles.footer}>NEXUS · 演示环境 · 权限边界由路由守卫与服务端中间件双重校验</div>
    </section>
  );
}
