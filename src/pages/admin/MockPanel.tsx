import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Activity,
  Banknote,
  Dices,
  Pause,
  Play,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { adminApi } from '@/api/endpoints';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { HudCard } from '@/components/HudCard';
import { NeonButton } from '@/components/NeonButton';
import { Segmented } from '@/components/Segmented';
import type { SegmentOption } from '@/components/Segmented';
import { StatusTag } from '@/components/StatusTag';
import { useAuthStore } from '@/store/authStore';
import { useStreamStore } from '@/store/streamStore';
import { useUiStore } from '@/store/uiStore';
import { formatDuration, formatLatency, formatNumber, formatUsdCompact, shortId } from '@/lib/format';
import type { AlertDTO, InjectType, StreamSpeed, TradeDTO } from '@/types';
import {
  SEED_MAX,
  SEED_MIN,
  STREAM_SPEEDS,
  describeAdminError,
  generateRandomSeed,
  normalizeStreamSpeed,
  parseSeedInput,
  validateInjectRequest,
} from './adminHelpers';
import ui from '@/styles/ui.module.css';
import styles from '@/styles/admin.module.css';

const INJECT_LABELS: Record<InjectType, string> = {
  large_trade: '大额交易',
  latency_spike: '延迟尖峰',
  risk_hit: '风控命中',
};

interface InjectScenario {
  type: InjectType;
  label: string;
  hint: string;
  icon: ReactNode;
  toneClass: string;
}

const INJECT_SCENARIOS: readonly InjectScenario[] = [
  {
    type: 'large_trade',
    label: '大额交易',
    hint: '$8M–20M NOTIONAL',
    icon: <Banknote size={13} />,
    toneClass: styles.injectAmber ?? '',
  },
  {
    type: 'latency_spike',
    label: '延迟尖峰',
    hint: '900–1600 MS PENDING',
    icon: <Activity size={13} />,
    toneClass: styles.injectMagenta ?? '',
  },
  {
    type: 'risk_hit',
    label: '风控命中',
    hint: 'AML RISK 85–99 FLAGGED',
    icon: <ShieldAlert size={13} />,
    toneClass: styles.injectRed ?? '',
  },
];

const SPEED_OPTIONS: SegmentOption<StreamSpeed>[] = STREAM_SPEEDS.map((value) => ({
  value,
  label: `${value}×`,
}));

type PendingKey = 'stream' | 'speed' | 'reset' | 'clear' | null;

type ConfirmState = { kind: 'reset'; seed: number } | { kind: 'clear' } | null;

interface MockPanelProps {
  /** 重置种子后触发用户列表重新拉取。 */
  onUsersRefresh?: () => void;
}

export function MockPanel({ onUsersRefresh }: MockPanelProps) {
  const token = useAuthStore((state) => state.token);
  const toast = useUiStore((state) => state.toast);
  const streamStatus = useStreamStore((state) => state.streamStatus);
  const currentSeed = useStreamStore((state) => state.meta?.seed ?? null);

  const [pending, setPending] = useState<PendingKey>(null);
  const [injecting, setInjecting] = useState<InjectType | null>(null);
  const [seedDraft, setSeedDraft] = useState('');
  const [seedTouched, setSeedTouched] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [lastInjection, setLastInjection] = useState<{ trade: TradeDTO; alert: AlertDTO } | null>(
    null,
  );

  useEffect(() => {
    if (currentSeed != null) setSeedDraft(String(currentSeed));
  }, [currentSeed]);

  const paused = streamStatus?.paused ?? false;
  const speed = normalizeStreamSpeed(streamStatus?.speed);
  const intervalMs = streamStatus?.intervalMs ?? 0;
  const clients = streamStatus?.clients ?? 0;
  const uptimeMs = streamStatus?.uptimeMs ?? 0;
  const busy = pending !== null || injecting !== null;
  const parsedSeed = parseSeedInput(seedDraft);
  const seedError = seedTouched && !parsedSeed.ok ? parsedSeed.error : null;

  const handleStream = async () => {
    if (!token) {
      toast('danger', '会话已失效，请重新登录');
      return;
    }
    if (busy) return;
    setPending('stream');
    try {
      const result = await adminApi.stream(token, { paused: !paused });
      useStreamStore.getState().setStreamStatus(result.stream);
      toast(
        'success',
        result.stream.paused
          ? '数据流已暂停'
          : `数据流已恢复 · ${normalizeStreamSpeed(result.stream.speed)}×`,
      );
    } catch (error) {
      toast('danger', describeAdminError(error, '数据流控制失败'));
    } finally {
      setPending(null);
    }
  };

  const handleSpeed = async (next: StreamSpeed) => {
    if (!token) {
      toast('danger', '会话已失效，请重新登录');
      return;
    }
    if (busy || next === speed) return;
    setPending('speed');
    try {
      const result = await adminApi.stream(token, { speed: next });
      useStreamStore.getState().setStreamStatus(result.stream);
      toast('success', `生成速率已切换为 ${next}×（${paused ? '恢复后生效' : '即时生效'}）`);
    } catch (error) {
      toast('danger', describeAdminError(error, '生成速率切换失败'));
    } finally {
      setPending(null);
    }
  };

  const handleRandomSeed = () => {
    const next = generateRandomSeed();
    setSeedDraft(String(next));
    setSeedTouched(false);
    toast('info', `随机种子 ${next} 已填入，重置后生效`);
  };

  const handleResetRequest = () => {
    setSeedTouched(true);
    if (!parsedSeed.ok) {
      toast('danger', parsedSeed.error);
      return;
    }
    setConfirm({ kind: 'reset', seed: parsedSeed.seed });
  };

  const handleConfirmReset = async () => {
    const request = confirm;
    if (!request || request.kind !== 'reset') return;
    setConfirm(null);
    if (!token) {
      toast('danger', '会话已失效，请重新登录');
      return;
    }
    setPending('reset');
    try {
      const result = await adminApi.reset(token, request.seed);
      const store = useStreamStore.getState();
      store.clearData();
      store.setMeta(result.meta);
      store.setStreamStatus({
        paused: result.meta.stream.paused,
        speed: result.meta.stream.speed,
        intervalMs: result.meta.stream.intervalMs,
        clients: result.meta.clients,
        uptimeMs: 0,
      });
      setSeedDraft(String(result.meta.seed));
      setSeedTouched(false);
      setLastInjection(null);
      onUsersRefresh?.();
      toast('success', `种子已重置为 ${result.meta.seed}，24H 历史数据已按种子重建`);
    } catch (error) {
      toast('danger', describeAdminError(error, '种子重置失败'));
    } finally {
      setPending(null);
    }
  };

  const handleClearRequest = () => setConfirm({ kind: 'clear' });

  const handleConfirmClear = async () => {
    setConfirm(null);
    if (!token) {
      toast('danger', '会话已失效，请重新登录');
      return;
    }
    setPending('clear');
    try {
      const result = await adminApi.clear(token);
      useStreamStore.getState().clearData();
      setLastInjection(null);
      toast(
        'success',
        `已清空 ${formatNumber(result.cleared.trades)} 笔交易与 ${formatNumber(result.cleared.alerts)} 条告警`,
      );
    } catch (error) {
      toast('danger', describeAdminError(error, '清空数据失败'));
    } finally {
      setPending(null);
    }
  };

  const handleInject = async (type: InjectType) => {
    if (!token) {
      toast('danger', '会话已失效，请重新登录');
      return;
    }
    if (busy) return;
    const validation = validateInjectRequest({ type });
    if (!validation.ok) {
      toast('danger', validation.error);
      return;
    }
    setInjecting(type);
    try {
      const result = await adminApi.inject(
        token,
        validation.payload.type,
        validation.payload.assetClass,
        validation.payload.nodeId,
      );
      setLastInjection(result.created);
      toast(
        'success',
        `已注入${INJECT_LABELS[type]} · ${result.created.trade.asset} ${formatUsdCompact(
          result.created.trade.amount,
        )}`,
      );
    } catch (error) {
      toast('danger', describeAdminError(error, '异常注入失败'));
    } finally {
      setInjecting(null);
    }
  };

  const resetSeed = confirm?.kind === 'reset' ? confirm.seed : null;

  return (
    <HudCard
      code="A-02 / MOCK ENGINE"
      title="Mock 数据控制台"
      en="SIMULATION CORE"
      className={styles.panel}
      actions={
        <>
          <span className={ui.badge}>ADMIN ONLY</span>
          <span className={ui.badge}>SEEDED</span>
        </>
      }
    >
      <div className={styles.mockBody}>
        <div className={styles.streamCard}>
          <div className={styles.streamTop}>
            <div className={styles.streamTitle}>
              <b>DATA STREAM / 数据流</b>
              <span className={`${styles.streamState} ${paused ? styles.streamPaused : ''}`}>
                {paused ? 'PAUSED' : 'RUNNING'}
              </span>
            </div>
            <span className={`${styles.streamDot} ${paused ? styles.streamDotPaused : ''}`} aria-hidden />
          </div>
          <div className={styles.streamMetrics}>
            <div className={styles.streamMetric}>
              <small>RATE</small>
              <b>{intervalMs ? `${(intervalMs / 1000).toFixed(1)}s / TX` : '—'}</b>
            </div>
            <div className={styles.streamMetric}>
              <small>SPEED</small>
              <b className={styles.cyan}>{speed}×</b>
            </div>
            <div className={styles.streamMetric}>
              <small>CLIENTS</small>
              <b>{clients}</b>
            </div>
            <div className={styles.streamMetric}>
              <small>UPTIME</small>
              <b className={styles.cyan}>{formatDuration(uptimeMs)}</b>
            </div>
          </div>
        </div>

        <div className={styles.actionRow}>
          <NeonButton
            variant={paused ? 'primary' : 'ghost'}
            icon={paused ? <Play size={12} /> : <Pause size={12} />}
            loading={pending === 'stream'}
            disabled={busy && pending !== 'stream'}
            onClick={() => void handleStream()}
          >
            {paused ? '恢复数据流' : '暂停数据流'}
          </NeonButton>
          <span className={styles.actionHint}>
            {paused ? 'PAUSED · 恢复后按当前速率继续生成' : 'RUNNING · 同步大屏 / 地图 / 明细'}
          </span>
        </div>

        <div className={styles.controlBlock}>
          <div className={styles.controlHead}>
            <span>生成速率 / GENERATION RATE</span>
            <b className={styles.cyan}>{speed}×</b>
          </div>
          <Segmented<StreamSpeed>
            options={SPEED_OPTIONS.map((option) => ({ ...option, disabled: busy }))}
            value={speed}
            onChange={(value) => void handleSpeed(value)}
            ariaLabel="Mock 数据生成速率"
          />
        </div>

        <div className={styles.controlBlock}>
          <div className={styles.controlHead}>
            <span>随机种子 / PRNG SEED</span>
            <span className={styles.controlBadge}>REPRODUCIBLE</span>
          </div>
          <div className={styles.seedRow}>
            <span className={styles.seedCurrent} title="服务端当前种子">
              <span>SEED</span>
              {currentSeed ?? '—'}
            </span>
            <input
              className={`${ui.input} ${styles.seedInput} ${seedError ? ui.inputError : ''}`}
              value={seedDraft}
              inputMode="numeric"
              maxLength={10}
              placeholder={`${SEED_MIN} ~ ${SEED_MAX}`}
              aria-label="新随机种子"
              aria-invalid={Boolean(seedError)}
              onChange={(event) => {
                setSeedDraft(event.target.value);
                setSeedTouched(true);
              }}
            />
            <NeonButton
              size="sm"
              variant="ghost"
              icon={<Dices size={12} />}
              disabled={busy}
              onClick={handleRandomSeed}
              title="生成随机种子"
            >
              随机
            </NeonButton>
          </div>
          {seedError && <span className={`${ui.fieldError} ${styles.seedError}`}>{seedError}</span>}
          <div className={styles.seedActions}>
            <span className={styles.seedHint}>范围 1 ~ 2147483646 · 相同种子生成相同历史</span>
            <NeonButton
              size="sm"
              variant="primary"
              icon={<RefreshCw size={12} />}
              loading={pending === 'reset'}
              disabled={busy && pending !== 'reset'}
              onClick={handleResetRequest}
            >
              重置种子
            </NeonButton>
          </div>
        </div>

        <div className={styles.injectHead}>
          <span>异常注入 / FAULT INJECTION</span>
          <span className={styles.amber}>3 SCENARIOS</span>
        </div>
        <div className={styles.injectGrid}>
          {INJECT_SCENARIOS.map((scenario) => (
            <NeonButton
              key={scenario.type}
              variant="ghost"
              className={`${styles.injectBtn} ${scenario.toneClass}`}
              icon={scenario.icon}
              loading={injecting === scenario.type}
              disabled={busy}
              onClick={() => void handleInject(scenario.type)}
              title={`注入${scenario.label}`}
            >
              <span className={styles.injectLabel}>{scenario.label}</span>
              <span className={styles.injectHint}>{scenario.hint}</span>
            </NeonButton>
          ))}
        </div>

        <div className={styles.injectResult}>
          {lastInjection ? (
            <>
              <div className={styles.resultHead}>
                <span>LAST INJECTION / 最近注入</span>
                <StatusTag status={lastInjection.trade.status} />
              </div>
              <div className={styles.resultGrid}>
                <div className={styles.resultCell}>
                  <small>TRADE ID</small>
                  <b>{shortId(lastInjection.trade.id, 16)}</b>
                </div>
                <div className={styles.resultCell}>
                  <small>ASSET</small>
                  <b>{lastInjection.trade.asset}</b>
                </div>
                <div className={styles.resultCell}>
                  <small>NOTIONAL</small>
                  <b className={styles.cyan}>{formatUsdCompact(lastInjection.trade.amount)}</b>
                </div>
                <div className={styles.resultCell}>
                  <small>LATENCY</small>
                  <b>{formatLatency(lastInjection.trade.latencyMs)}</b>
                </div>
                <div className={styles.resultCell}>
                  <small>RISK SCORE</small>
                  <b>{lastInjection.trade.riskScore.toFixed(1)}</b>
                </div>
              </div>
              <div className={styles.resultAlert}>
                <StatusTag status={lastInjection.alert.level} />
                <span>{lastInjection.alert.message}</span>
              </div>
            </>
          ) : (
            <div className={styles.resultEmpty}>
              <Activity size={16} />
              <span>尚未注入异常</span>
              <small>点击上方场景按钮，生成一笔模拟交易与对应告警</small>
            </div>
          )}
        </div>

        <div className={styles.consoleActions}>
          <NeonButton
            variant="danger"
            icon={<Trash2 size={12} />}
            loading={pending === 'clear'}
            disabled={busy && pending !== 'clear'}
            onClick={handleClearRequest}
          >
            清空数据
          </NeonButton>
          <span className={styles.actionHint}>清空后不重建历史 · 数据流继续运行</span>
        </div>

        <div className={styles.securityNote}>
          <ShieldCheck size={13} />
          <span>
            <b>所有操作仅改变前端内存态，刷新后按固定种子恢复。</b> 不会产生真实交易、订单或资金流；演示鉴权，非真实安全。
          </span>
        </div>
      </div>

      <ConfirmDialog
        open={confirm?.kind === 'reset'}
        code="SEED-RESET"
        title="重置随机种子"
        description={`将清空当前交易与告警，并按种子 ${resetSeed ?? '—'} 重建 24H 历史；数据流会恢复为 1× 运行。`}
        confirmText="确认重置"
        onCancel={() => setConfirm(null)}
        onConfirm={handleConfirmReset}
      />

      <ConfirmDialog
        open={confirm?.kind === 'clear'}
        code="CLEAR-DATA"
        title="清空全部交易与告警"
        description="清空后不会重建历史数据；当前数据流继续运行并产生新数据。此操作仅影响演示用内存数据。"
        confirmText="确认清空"
        danger
        onCancel={() => setConfirm(null)}
        onConfirm={handleConfirmClear}
      />
    </HudCard>
  );
}
