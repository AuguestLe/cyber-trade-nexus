import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, LogOut, Maximize2, Minimize2, Radio } from 'lucide-react';
import { adminApi } from '@/api/endpoints';
import { useAuthStore } from '@/store/authStore';
import { useStreamStore } from '@/store/streamStore';
import { useUiStore } from '@/store/uiStore';
import { usePermission } from '@/hooks/usePermission';
import { useClock } from '@/hooks/useClock';
import { useFullscreen } from '@/hooks/useCountUp';
import { formatClock, formatDate } from '@/lib/format';
import type { ConnectionState, User } from '@/types';
import styles from '@/styles/layout.module.css';
import ui from '@/styles/ui.module.css';

const NAV_ITEMS: Array<{ to: string; index: string; label: string; adminOnly?: boolean }> = [
  { to: '/', index: '01', label: '态势总览' },
  { to: '/map', index: '02', label: '全球地图' },
  { to: '/trades', index: '03', label: '交易明细' },
  { to: '/admin', index: '04', label: '控制台', adminOnly: true },
];

function connectionMeta(state: ConnectionState, paused: boolean): { label: string; tone: 'on' | 'busy' | 'off' } {
  if (paused) return { label: 'STREAM / PAUSED', tone: 'busy' };
  if (state === 'open') return { label: 'STREAM / LIVE', tone: 'on' };
  if (state === 'connecting') return { label: 'STREAM / LINKING', tone: 'busy' };
  if (state === 'retrying') return { label: 'STREAM / RETRY', tone: 'busy' };
  return { label: 'STREAM / OFFLINE', tone: 'off' };
}

export function TopBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const now = useClock();
  const { user, isAdmin } = usePermission();
  const token = useAuthStore((state) => state.token);
  const logout = useAuthStore((state) => state.logout);
  const impersonate = useAuthStore((state) => state.impersonate);
  const connection = useStreamStore((state) => state.connection);
  const streamStatus = useStreamStore((state) => state.streamStatus);
  const toast = useUiStore((state) => state.toast);
  const { fullscreen, toggle } = useFullscreen();
  const [menuOpen, setMenuOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [switching, setSwitching] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen || !isAdmin || !token) return;
    let cancelled = false;
    adminApi
      .users(token)
      .then((result) => {
        if (!cancelled) setUsers(result.items);
      })
      .catch(() => {
        if (!cancelled) toast('warn', '用户列表加载失败');
      });
    return () => {
      cancelled = true;
    };
  }, [menuOpen, isAdmin, token, toast]);

  const status = connectionMeta(connection, Boolean(streamStatus?.paused));
  const speed = streamStatus?.speed ?? 1;
  const initials = user?.displayName?.slice(-1) ?? 'N';

  const handleImpersonate = async (target: User) => {
    if (target.id === user?.id) return;
    setSwitching(true);
    try {
      await impersonate(target.id);
      setMenuOpen(false);
      toast('success', `已切换为 ${target.displayName}`);
    } catch {
      toast('danger', '身份切换失败');
    } finally {
      setSwitching(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const handleFullscreen = async () => {
    await toggle();
    if (!document.fullscreenElement) {
      toast('warn', '全屏请求被浏览器或系统阻止');
    }
  };

  return (
    <header className={styles.topbar}>
      <div className={styles.brand}>
        <div className={styles.logoMark}>
          <span>N</span>
        </div>
        <div className={styles.brandText}>
          <span className={styles.brandName}>NEXUS</span>
          <span className={styles.brandSub}>GLOBAL TRADING COMMAND</span>
        </div>
        <span className={styles.demoBadge}>DEMO</span>
      </div>

      <nav className={styles.nav} aria-label="主导航">
        {NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin).map((item) => {
          const active = item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to);
          return (
            <button
              key={item.to}
              type="button"
              className={`${styles.navItem} ${active ? styles.navActive : ''}`}
              onClick={() => navigate(item.to)}
              aria-current={active ? 'page' : undefined}
            >
              <span className={styles.navIndex}>{item.index}</span>
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className={styles.topRight}>
        <span
          className={`${styles.statusPill} ${
            status.tone === 'on' ? styles.statusPillOn : status.tone === 'busy' ? styles.statusPillBusy : styles.statusPillOff
          }`}
          title="数据流连接状态"
        >
          <Radio size={11} />
          {status.label}
          {!streamStatus?.paused && <span style={{ color: 'var(--text-3)' }}>{speed}×</span>}
        </span>

        <div className={styles.clock} aria-label="全局时钟">
          <span className={styles.clockDate}>{formatDate(now)} · CST / SHANGHAI</span>
          <span className={styles.clockTime}>{formatClock(now)}</span>
        </div>

        <button type="button" className={styles.iconBtn} onClick={() => void handleFullscreen()} aria-label="全屏切换">
          {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>

        <div className={styles.identity} ref={menuRef}>
          <button
            type="button"
            className={styles.identityButton}
            onClick={() => setMenuOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <span className={styles.avatar}>{initials}</span>
            <span className={styles.identityMeta}>
              <span className={styles.identityName}>{user?.displayName ?? '未登录'}</span>
              <span className={styles.identityRole}>
                {user?.role === 'admin' ? 'ADMIN · FULL ACCESS' : 'VIEWER · READ ONLY'}
              </span>
            </span>
            <ChevronDown size={12} color="var(--text-3)" />
          </button>

          {menuOpen && (
            <div className={styles.identityMenu} role="menu">
              <section className={styles.menuSection}>
                <div className={styles.menuLabel}>CURRENT SESSION / 当前会话</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className={styles.avatar}>{initials}</span>
                  <div>
                    <div style={{ fontSize: 12 }}>{user?.displayName}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)' }}>
                      {user?.username} · {user?.role.toUpperCase()}
                    </div>
                  </div>
                </div>
              </section>

              {isAdmin && (
                <section className={styles.menuSection}>
                  <div className={styles.menuLabel}>DEMO IDENTITY / 切换演示身份</div>
                  {users.length === 0 && <div className={styles.menuDemoNote}>正在读取用户列表…</div>}
                  {users
                    .filter((item) => item.enabled)
                    .map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`${styles.menuUser} ${item.id === user?.id ? styles.menuUserActive : ''}`}
                        onClick={() => void handleImpersonate(item)}
                        disabled={switching}
                        role="menuitem"
                      >
                        <span className={styles.avatar} style={{ width: 22, height: 22, fontSize: 9 }}>
                          {item.displayName.slice(-1)}
                        </span>
                        <span style={{ flex: 1 }}>{item.displayName}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)' }}>
                          {item.role.toUpperCase()}
                        </span>
                      </button>
                    ))}
                </section>
              )}

              <div className={styles.menuFooter}>
                <button
                  type="button"
                  className={`${ui.btn} ${ui.btnSm}`}
                  style={{ width: '100%' }}
                  onClick={() => void handleLogout()}
                >
                  <LogOut size={11} />
                  退出登录
                </button>
                <div className={styles.menuDemoNote}>
                  演示系统 · 身份切换仅影响当前浏览器会话，不具备真实安全性
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
