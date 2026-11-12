import { useState } from 'react';
import { Database, ShieldCheck } from 'lucide-react';
import { HudCard } from '@/components/HudCard';
import { Segmented } from '@/components/Segmented';
import type { SegmentOption } from '@/components/Segmented';
import { Toggle } from '@/components/Toggle';
import { usePermission } from '@/hooks/usePermission';
import { useConfigStore } from '@/store/configStore';
import { useUiStore } from '@/store/uiStore';
import { formatClock } from '@/lib/format';
import { THEME_LABELS } from '@/lib/theme';
import type { MotionMode, ThemeKey } from '@/types';
import { isRefreshMs } from './adminHelpers';
import ui from '@/styles/ui.module.css';
import styles from '@/styles/admin.module.css';

interface ThemeCard {
  key: ThemeKey;
  note: string;
  swatches: [string, string, string];
}

const THEME_CARDS: readonly ThemeCard[] = [
  { key: 'cyan', note: 'DEFAULT / 主霓虹', swatches: ['#00F0FF', '#7B5CFF', '#101A2E'] },
  { key: 'amber', note: 'COMMAND / 警示增强', swatches: ['#FFB547', '#FF4D6D', '#20170C'] },
  { key: 'ice', note: 'ANALYTIC / 冷色降噪', swatches: ['#B8F4FF', '#5BA8FF', '#0B1824'] },
];

const MOTION_OPTIONS: SegmentOption<MotionMode>[] = [
  { value: 'full', label: '完整 / FULL' },
  { value: 'reduced', label: '降低 / REDUCED' },
];

const REFRESH_OPTIONS: SegmentOption<number>[] = [
  { value: 1000, label: '1S' },
  { value: 2000, label: '2S' },
  { value: 5000, label: '5S' },
];

export function SettingsPanel() {
  const { user } = usePermission();
  const theme = useConfigStore((state) => state.theme);
  const motion = useConfigStore((state) => state.motion);
  const refreshMs = useConfigStore((state) => state.refreshMs);
  const watermark = useConfigStore((state) => state.watermark);
  const setTheme = useConfigStore((state) => state.setTheme);
  const setMotion = useConfigStore((state) => state.setMotion);
  const setRefresh = useConfigStore((state) => state.setRefresh);
  const setWatermark = useConfigStore((state) => state.setWatermark);
  const toast = useUiStore((state) => state.toast);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const markSaved = () => setSavedAt(Date.now());

  const handleTheme = (next: ThemeKey) => {
    if (next === theme) return;
    setTheme(next);
    markSaved();
    toast('success', `配色主题已切换为 ${THEME_LABELS[next]}（即时生效）`);
  };

  const handleMotion = (next: MotionMode) => {
    if (next === motion) return;
    setMotion(next);
    markSaved();
    toast('success', `动效强度已切换为 ${next === 'full' ? '完整 / FULL' : '降低 / REDUCED'}（即时生效）`);
  };

  const handleRefresh = (next: number) => {
    if (!isRefreshMs(next) || next === refreshMs) return;
    setRefresh(next);
    markSaved();
    toast('success', `刷新频率已设为 ${next / 1000}s（即时生效）`);
  };

  const handleWatermark = (next: boolean) => {
    if (next === watermark) return;
    setWatermark(next);
    markSaved();
    toast('success', next ? 'DEMO 水印已开启（即时生效）' : 'DEMO 水印已关闭（即时生效）');
  };

  return (
    <HudCard
      code="A-03 / SETTINGS"
      title="系统设置"
      en="SYSTEM PREFERENCES"
      className={styles.panel}
      actions={
        <>
          <span className={ui.badge}>LIVE APPLY</span>
          <span className={ui.badge}>LOCAL</span>
        </>
      }
    >
      <div className={styles.settingsBody}>
        <section className={styles.settingSection}>
          <div className={styles.sectionHead}>
            <span>配色主题 / THEME</span>
            <span>3 PRESETS</span>
          </div>
          <div className={styles.themeGrid}>
            {THEME_CARDS.map((card) => {
              const active = card.key === theme;
              return (
                <button
                  key={card.key}
                  type="button"
                  className={`${styles.themeCard} ${active ? styles.themeCardActive : ''}`}
                  onClick={() => handleTheme(card.key)}
                  aria-pressed={active}
                >
                  <span className={styles.swatchRow} aria-hidden>
                    {card.swatches.map((color) => (
                      <i key={color} className={styles.swatch} style={{ background: color }} />
                    ))}
                  </span>
                  <b className={styles.themeName}>{THEME_LABELS[card.key]}</b>
                  <small className={styles.themeNote}>{card.note}</small>
                  {active && <span className={styles.themeCheck}>✓</span>}
                </button>
              );
            })}
          </div>
        </section>

        <section className={styles.settingSection}>
          <div className={styles.sectionHead}>
            <span>动效强度 / MOTION</span>
            <span>2 MODES</span>
          </div>
          <Segmented<MotionMode>
            options={MOTION_OPTIONS}
            value={motion}
            onChange={handleMotion}
            ariaLabel="动效强度"
          />
          <p className={styles.settingHint}>
            完整保留扫描线、脉冲与飞线粒子；降低档关闭装饰动效，并尊重系统的 prefers-reduced-motion。
          </p>
        </section>

        <section className={styles.settingSection}>
          <div className={styles.sectionHead}>
            <span>刷新频率 / REFRESH</span>
            <span className={styles.cyan}>{refreshMs / 1000}S</span>
          </div>
          <Segmented<number>
            options={REFRESH_OPTIONS}
            value={refreshMs}
            onChange={handleRefresh}
            ariaLabel="数据刷新频率"
          />
          <p className={styles.settingHint}>影响轮询类数据的重新拉取间隔；1s 最实时，5s 最省资源。</p>
        </section>

        <section className={styles.settingSection}>
          <div className={styles.sectionHead}>
            <span>运行偏好 / RUNTIME</span>
            <span>LOCAL STORAGE</span>
          </div>
          <div className={styles.runtimeRow}>
            <div className={styles.runtimeTitle}>
              <b>DEMO 水印</b>
              <small>WATERMARK / 大屏演示标识</small>
            </div>
            <Toggle checked={watermark} onChange={handleWatermark} />
          </div>
        </section>

        <section className={styles.settingSection}>
          <div className={styles.sectionHead}>
            <span>会话与权限 / SESSION</span>
            <span>DEMO ONLY</span>
          </div>
          <div className={styles.kvGrid}>
            <div className={styles.kvItem}>
              <small>ACTIVE ROLE</small>
              <b className={styles.cyan}>{user?.role === 'admin' ? 'ADMIN / L4' : 'VIEWER / READ ONLY'}</b>
            </div>
            <div className={styles.kvItem}>
              <small>ACCESS</small>
              <b className={styles.green}>
                {user?.role === 'admin' ? 'FULL ACCESS' : 'RESTRICTED'}
              </b>
            </div>
            <div className={styles.kvItem}>
              <small>SESSION MODE</small>
              <b>LOCAL MOCK</b>
            </div>
            <div className={styles.kvItem}>
              <small>AUTH PROVIDER</small>
              <b className={styles.green}>SIMULATED</b>
            </div>
          </div>
        </section>

        <section className={styles.settingSection}>
          <div className={styles.sectionHead}>
            <span>演示边界 / DEMO SCOPE</span>
            <span>FROZEN SPEC</span>
          </div>
          <div className={styles.scopeRow}>
            <span className={styles.scopeChip}>注入 3 类</span>
            <span className={styles.scopeChip}>动效 2 档</span>
            <span className={styles.scopeChip}>刷新 3 档</span>
            <span className={styles.scopeChip}>无真实资金</span>
          </div>
          <p className={styles.settingHint}>
            数据仅来自本地 Mock 引擎，鉴权为模拟实现；界面不会展示或保存密码。
          </p>
        </section>

        <section className={`${styles.settingSection} ${styles.storageSection}`}>
          <div className={styles.sectionHead}>
            <span>
              <Database size={11} /> 本地存储 / DEMO MODE
            </span>
            <span>DEMO ONLY</span>
          </div>
          <div className={styles.kvGrid}>
            <div className={styles.kvItem}>
              <small>STORAGE</small>
              <b>localStorage</b>
            </div>
            <div className={styles.kvItem}>
              <small>PREF KEY</small>
              <b>nexus.prefs</b>
            </div>
            <div className={styles.kvItem}>
              <small>SESSION KEY</small>
              <b>nexus.auth</b>
            </div>
            <div className={styles.kvItem}>
              <small>PASSWORD</small>
              <b className={styles.amber}>NOT STORED</b>
            </div>
          </div>
          <p className={styles.storageNote}>
            <ShieldCheck size={11} /> 演示鉴权，非真实安全：主题 / 动效 / 刷新 / 水印偏好仅保存在当前浏览器；业务数据存于
            Mock 服务内存，刷新后按种子重建。
          </p>
        </section>

        <div className={styles.savedNote}>
          <span className={styles.savedDot} aria-hidden />
          配置即时生效并保存至本地浏览器{savedAt ? ` · LAST SAVED ${formatClock(savedAt)}` : ''}
        </div>
      </div>
    </HudCard>
  );
}
