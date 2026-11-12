import { useState } from 'react';
import { ArrowUpRight, ShieldAlert, Shuffle } from 'lucide-react';
import { usePermission } from '@/hooks/usePermission';
import { useStreamStore } from '@/store/streamStore';
import { useUiStore } from '@/store/uiStore';
import { normalizeStreamSpeed } from './admin/adminHelpers';
import { MockPanel } from './admin/MockPanel';
import { SettingsPanel } from './admin/SettingsPanel';
import { UserPanel } from './admin/UserPanel';
import styles from '@/styles/admin.module.css';

type MetricTone = 'default' | 'cyan' | 'amber' | 'green' | 'red';

const TONE_CLASS: Record<Exclude<MetricTone, 'default'>, string> = {
  cyan: styles.cyan ?? '',
  amber: styles.amber ?? '',
  green: styles.green ?? '',
  red: styles.red ?? '',
};

function StatusMetric({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: MetricTone;
}) {
  const toneClass = tone === 'default' ? '' : TONE_CLASS[tone];
  return (
    <div className={styles.metric} title={`${label} / ${value}`}>
      <small className={styles.metricLabel}>{label}</small>
      <b className={`${styles.metricValue} ${toneClass}`}>{value}</b>
    </div>
  );
}

export function AdminPage() {
  const { user } = usePermission();
  const meta = useStreamStore((state) => state.meta);
  const streamStatus = useStreamStore((state) => state.streamStatus);
  const alerts = useStreamStore((state) => state.alerts);
  const toast = useUiStore((state) => state.toast);
  const [usersRefreshKey, setUsersRefreshKey] = useState(0);

  const paused = streamStatus?.paused ?? meta?.stream.paused ?? false;
  const speed = normalizeStreamSpeed(streamStatus?.speed ?? meta?.stream.speed);
  const clients = streamStatus?.clients ?? meta?.clients ?? 0;
  const seed = meta?.seed ?? null;
  const openAlerts = alerts.filter((alert) => !alert.handled).length;

  const handleIdentityEntry = () => {
    const entry = document.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]');
    if (entry) {
      entry.focus();
      entry.click();
      toast('info', '已打开 TopBar 演示身份菜单，选择目标身份即可切换');
      return;
    }
    toast('info', '请使用右上角身份菜单，或在用户列表逐行点击「切换」');
  };

  return (
    <div className={styles.page}>
      <header className={styles.statusBar}>
        <div className={styles.statusBrand}>
          <span className={styles.pageTag}>ADMIN-01 / CONTROL</span>
          <h1 className={styles.pageTitle}>
            管理员控制台
            <span>SYSTEM GOVERNANCE</span>
          </h1>
        </div>

        <div className={styles.metrics}>
          <StatusMetric
            label="IDENTITY"
            value={`${user?.displayName ?? '未登录'} / ${(user?.role ?? '—').toUpperCase()}`}
          />
          <StatusMetric label="CLEARANCE" value="FULL ACCESS" tone="cyan" />
          <StatusMetric
            label="STREAM"
            value={`${paused ? 'PAUSED' : 'RUNNING'} · ${speed}× · ${clients} CL`}
            tone={paused ? 'amber' : 'green'}
          />
          <StatusMetric
            label="INCIDENT"
            value={`${openAlerts} OPEN`}
            tone={openAlerts > 0 ? 'amber' : 'green'}
          />
          <StatusMetric label="SEED" value={seed != null ? String(seed) : '—'} />
        </div>

        <div className={styles.statusRight}>
          <span className={styles.demoAuthChip}>
            <ShieldAlert size={11} />
            DEMO AUTH · 非真实安全
          </span>
          <button
            type="button"
            className={styles.identityEntry}
            onClick={handleIdentityEntry}
            title="打开 TopBar 身份菜单"
          >
            <Shuffle size={12} />
            一键切换演示身份
            <ArrowUpRight size={11} />
          </button>
        </div>
      </header>

      <div className={styles.grid}>
        <UserPanel refreshKey={usersRefreshKey} />
        <MockPanel onUsersRefresh={() => setUsersRefreshKey((key) => key + 1)} />
        <SettingsPanel />
      </div>
    </div>
  );
}
