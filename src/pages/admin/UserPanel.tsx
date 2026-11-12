import { useEffect, useState } from 'react';
import { ArrowLeftRight, ShieldAlert } from 'lucide-react';
import { adminApi } from '@/api/endpoints';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { HudCard } from '@/components/HudCard';
import { NeonButton } from '@/components/NeonButton';
import { StatusTag } from '@/components/StatusTag';
import { Toggle } from '@/components/Toggle';
import { EmptyState, ErrorState, LoadingBlock } from '@/components/States';
import { useResource } from '@/hooks/useResource';
import { useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';
import { formatClock, formatDate } from '@/lib/format';
import type { Role, User } from '@/types';
import { checkRoleChange, checkToggleUser, describeAdminError, isBuiltinUser } from './adminHelpers';
import ui from '@/styles/ui.module.css';
import styles from '@/styles/admin.module.css';

const ROLE_LABELS: Record<Role, string> = {
  admin: 'ADMIN',
  viewer: 'VIEWER',
};

function parseRole(value: string): Role | null {
  if (value === 'admin' || value === 'viewer') return value;
  return null;
}

interface UserPanelProps {
  /** Mock 数据重置后由 AdminPage 递增，强制重新拉取用户列表。 */
  refreshKey?: number;
}

export function UserPanel({ refreshKey = 0 }: UserPanelProps) {
  const token = useAuthStore((state) => state.token);
  const currentUser = useAuthStore((state) => state.user);
  const impersonate = useAuthStore((state) => state.impersonate);
  const toast = useUiStore((state) => state.toast);

  const [pending, setPending] = useState<{ id: string; kind: 'toggle' | 'role' } | null>(null);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [confirmUser, setConfirmUser] = useState<User | null>(null);
  const [lastSync, setLastSync] = useState<number>(() => Date.now());

  const usersResource = useResource<User[]>(
    () => adminApi.users(token ?? '').then((result) => result.items),
    [token, refreshKey],
    { enabled: Boolean(token) },
  );
  const users = usersResource.data ?? [];
  const loading = usersResource.loading && !usersResource.data;
  const busy = Boolean(pending) || switchingId !== null;

  useEffect(() => {
    if (usersResource.data) setLastSync(Date.now());
  }, [usersResource.data]);

  const activeCount = users.filter((user) => user.enabled).length;
  const disabledCount = users.length - activeCount;

  const mutateUser = async (
    target: User,
    patch: { enabled?: boolean; role?: Role },
    kind: 'toggle' | 'role',
    successMessage: string,
  ) => {
    if (!token) {
      toast('danger', '会话已失效，请重新登录');
      return;
    }
    setPending({ id: target.id, kind });
    try {
      await adminApi.updateUser(token, target.id, patch);
      toast('success', successMessage);
      usersResource.reload();
    } catch (error) {
      toast('danger', describeAdminError(error, '用户更新失败，请稍后重试'));
    } finally {
      setPending(null);
    }
  };

  const handleToggle = (target: User, nextEnabled: boolean) => {
    if (busy || nextEnabled === target.enabled) return;
    const check = checkToggleUser(users, target.id, nextEnabled);
    if (!check.allowed) {
      toast('danger', check.message);
      return;
    }
    if (!nextEnabled) {
      setConfirmUser(target);
      return;
    }
    void mutateUser(target, { enabled: true }, 'toggle', `已启用用户 ${target.displayName}`);
  };

  const handleRoleChange = (target: User, rawValue: string) => {
    const nextRole = parseRole(rawValue);
    if (!nextRole || busy || nextRole === target.role) return;
    if (!currentUser) {
      toast('danger', '会话身份缺失，请重新登录');
      return;
    }
    const check = checkRoleChange(users, currentUser.id, target.id, nextRole);
    if (!check.allowed) {
      toast('danger', check.message);
      return;
    }
    void mutateUser(
      target,
      { role: nextRole },
      'role',
      `已将 ${target.displayName} 的角色切换为 ${ROLE_LABELS[nextRole]}`,
    );
  };

  const handleImpersonate = async (target: User) => {
    if (busy || !currentUser || target.id === currentUser.id) return;
    setSwitchingId(target.id);
    try {
      await impersonate(target.id);
      toast('success', `已切换为 ${target.displayName}，TopBar 身份已同步`);
      if (target.role === 'viewer') {
        toast('warn', '当前为 viewer，控制台将按权限隐藏');
      }
    } catch (error) {
      toast('danger', describeAdminError(error, '演示身份切换失败'));
    } finally {
      setSwitchingId(null);
    }
  };

  const handleConfirmDisable = async () => {
    const target = confirmUser;
    setConfirmUser(null);
    if (!target) return;
    await mutateUser(target, { enabled: false }, 'toggle', `已停用 ${target.displayName}，其会话已失效`);
  };

  return (
    <HudCard
      code="A-01 / USERS"
      title="用户管理"
      en="IDENTITY REGISTRY"
      className={styles.panel}
      actions={
        <>
          <span className={ui.badge}>{String(users.length).padStart(2, '0')} USERS</span>
          <span className={ui.badge}>ADMIN ONLY</span>
        </>
      }
    >
      <div className={styles.userBody}>
        <div className={styles.summaryBar}>
          <span>
            ACTIVE <b className={styles.green}>{activeCount}</b> · DISABLED{' '}
            <b className={styles.amber}>{disabledCount}</b>
          </span>
          <span>
            LAST SYNC <b>{formatClock(lastSync)}</b>
          </span>
        </div>

        <div className={styles.tableHead} aria-hidden>
          <span>USER / 用户</span>
          <span>ROLE / 角色</span>
          <span>STATUS</span>
          <span>LAST LOGIN</span>
          <span>ACTION</span>
        </div>

        <div className={styles.userList}>
          {loading && <LoadingBlock height={220} rows={4} />}

          {!loading && usersResource.error && users.length === 0 && (
            <ErrorState message={usersResource.error} onRetry={usersResource.reload} />
          )}

          {!loading && !usersResource.error && users.length === 0 && (
            <EmptyState title="暂无用户" description="Mock 用户库为空，请检查服务端种子数据。" />
          )}

          {users.map((item) => {
            const isSelf = item.id === currentUser?.id;
            const rowPending = pending?.id === item.id;
            return (
              <div
                key={item.id}
                className={`${styles.userRow} ${isSelf ? styles.userRowSelf : ''}`}
                aria-current={isSelf ? 'true' : undefined}
              >
                <div className={styles.userInfo}>
                  <span className={styles.userAvatar}>{item.displayName.slice(0, 1)}</span>
                  <div className={styles.userText}>
                    <div className={styles.userName}>
                      <span className={styles.userNameText}>{item.displayName}</span>
                      {isSelf && <span className={styles.selfTag}>YOU</span>}
                      {isBuiltinUser(item) && <span className={styles.builtinBadge}>内置</span>}
                    </div>
                    <span className={styles.userMeta}>@{item.username}</span>
                  </div>
                </div>

                <select
                  className={styles.roleSelect}
                  data-role={item.role}
                  value={item.role}
                  disabled={!currentUser || busy}
                  aria-label={`修改 ${item.displayName} 的角色`}
                  title={
                    isSelf
                      ? '本人角色受 SELF_ROLE 规则保护'
                      : `当前角色 ${ROLE_LABELS[item.role]}，可切换`
                  }
                  onChange={(event) => handleRoleChange(item, event.target.value)}
                >
                  <option value="admin">ADMIN</option>
                  <option value="viewer">VIEWER</option>
                </select>

                <div className={styles.statusCell} title={item.enabled ? '点击停用用户' : '点击启用用户'}>
                  <StatusTag status={item.enabled ? 'normal' : 'failed'} label={item.enabled ? '启用' : '停用'} />
                  <Toggle
                    checked={item.enabled}
                    disabled={!currentUser || busy}
                    onChange={(next) => handleToggle(item, next)}
                  />
                </div>

                <div className={styles.lastLogin}>
                  {item.lastLoginAt ? (
                    <>
                      <span>{formatDate(item.lastLoginAt)}</span>
                      <small>{formatClock(item.lastLoginAt)}</small>
                    </>
                  ) : (
                    <span className={styles.never}>从未登录</span>
                  )}
                </div>

                <NeonButton
                  size="sm"
                  variant={isSelf ? 'quiet' : 'ghost'}
                  className={styles.switchBtn}
                  icon={switchingId === item.id ? undefined : <ArrowLeftRight size={11} />}
                  loading={switchingId === item.id}
                  disabled={!item.enabled || isSelf || !currentUser || busy}
                  title={
                    isSelf
                      ? '当前已是该演示身份'
                      : item.enabled
                        ? `切换为 ${item.displayName}（TopBar 同步）`
                        : '停用账号不可切换身份'
                  }
                  onClick={() => void handleImpersonate(item)}
                >
                  {isSelf ? '当前' : rowPending ? '处理中' : '切换'}
                </NeonButton>
              </div>
            );
          })}
        </div>

        <div className={styles.identityBlock}>
          <div className={styles.blockHead}>
            <span>当前演示身份 / ACTIVE PERSONA</span>
            <span>ADMIN ONLY</span>
          </div>
          <div className={styles.identityRow}>
            <span className={styles.identityAvatar}>{currentUser?.displayName.slice(-1) ?? '?'}</span>
            <div className={styles.identityText}>
              <b className={styles.identityName}>{currentUser?.displayName ?? '未登录'}</b>
              <small className={styles.identityMeta}>
                @{currentUser?.username ?? '—'} · {currentUser ? ROLE_LABELS[currentUser.role] : '—'}
              </small>
            </div>
            <StatusTag status="info" label="FULL ACCESS" />
          </div>
          <p className={styles.identityHintText}>
            行内「切换」调用 authStore.impersonate，成功后 TopBar 身份同步；切换到 viewer 后本页将被路由守卫隐藏。
          </p>
        </div>

        <div className={styles.securityNote}>
          <ShieldAlert size={13} />
          <span>
            <b>演示鉴权，非真实安全。</b> 用户启停与角色切换仅影响本地 Mock 会话，不保存密码；viewer 无权访问控制台。
          </span>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(confirmUser)}
        code="USER-DISABLE"
        title={`停用用户 ${confirmUser?.displayName ?? ''}`}
        description="停用后该用户的所有会话将立即失效，需重新启用才能登录。此操作仅影响本地演示数据，不会产生真实业务影响。"
        confirmText="确认停用"
        danger
        onCancel={() => setConfirmUser(null)}
        onConfirm={handleConfirmDisable}
      />
    </HudCard>
  );
}
