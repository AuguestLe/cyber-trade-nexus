import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Fingerprint, RefreshCw, ShieldCheck, UserRound } from 'lucide-react';
import { ApiError } from '@/api/client';
import { useAuthStore } from '@/store/authStore';
import { createCaptcha, isCaptchaValid } from '@/lib/captcha';
import { formatClock, formatDate } from '@/lib/format';
import { useClock } from '@/hooks/useClock';
import { NeonButton } from '@/components/NeonButton';
import { WORLD_OUTLINE, WORLD_PROJECTION, WORLD_VIEWBOX } from '@/map/worldOutline';
import styles from '@/styles/login.module.css';

const DEMO_ACCOUNTS = [
  { username: 'admin', password: 'admin123', label: '管理员', role: 'ADMIN' },
  { username: 'viewer', password: 'viewer123', label: '观察员', role: 'VIEWER' },
];

const PARTICLES = [
  { lon: 121.47, lat: 31.23 },
  { lon: 114.17, lat: 22.32 },
  { lon: 103.82, lat: 1.35 },
  { lon: 139.69, lat: 35.69 },
  { lon: -0.13, lat: 51.5 },
  { lon: 8.68, lat: 50.11 },
  { lon: -74.0, lat: 40.71 },
  { lon: -87.63, lat: 41.88 },
  { lon: 55.27, lat: 25.2 },
  { lon: 151.21, lat: -33.87 },
  { lon: -46.63, lat: -23.55 },
  { lon: -99.13, lat: 19.43 },
];

function project(lon: number, lat: number): [number, number] {
  const rad = Math.PI / 180;
  return [
    WORLD_PROJECTION.scale * lon * rad + WORLD_PROJECTION.translate[0],
    -WORLD_PROJECTION.scale * lat * rad + WORLD_PROJECTION.translate[1],
  ];
}

function CaptchaCanvas({ code, onRefresh }: { code: string; onRefresh(): void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(5,9,18,0.9)';
    ctx.fillRect(0, 0, width, height);

    for (let i = 0; i < 5; i += 1) {
      ctx.strokeStyle = `rgba(0,240,255,${0.08 + Math.random() * 0.12})`;
      ctx.beginPath();
      ctx.moveTo(Math.random() * width, Math.random() * height);
      ctx.lineTo(Math.random() * width, Math.random() * height);
      ctx.stroke();
    }

    const fontSize = 22;
    ctx.font = `700 ${fontSize}px ui-monospace, Menlo, monospace`;
    ctx.textBaseline = 'middle';
    for (let i = 0; i < code.length; i += 1) {
      const x = 18 + i * 23;
      const y = height / 2 + (Math.random() - 0.5) * 4;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((Math.random() - 0.5) * 0.45);
      ctx.fillStyle = ['#00f0ff', '#7b5cff', '#ff2bd6', '#e6f5ff'][i % 4];
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 6;
      ctx.fillText(code[i], 0, 0);
      ctx.restore();
    }

    ctx.shadowBlur = 0;
    for (let i = 0; i < 22; i += 1) {
      ctx.fillStyle = `rgba(0,240,255,${0.15 + Math.random() * 0.25})`;
      ctx.beginPath();
      ctx.arc(Math.random() * width, Math.random() * height, Math.random() * 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [code]);

  return (
    <button type="button" className={styles.captcha} onClick={onRefresh} aria-label="点击刷新验证码">
      <canvas ref={canvasRef} width={116} height={38} />
      <RefreshCw size={11} className={styles.captchaRefresh} />
    </button>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const now = useClock();
  const token = useAuthStore((state) => state.token);
  const status = useAuthStore((state) => state.status);
  const login = useAuthStore((state) => state.login);
  const storeError = useAuthStore((state) => state.error);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [captcha, setCaptcha] = useState(() => createCaptcha());
  const [captchaInput, setCaptchaInput] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const from = (location.state as { from?: string } | null)?.from ?? '/';
  const loading = status === 'loading';

  useEffect(() => {
    setLocalError(null);
    useAuthStore.getState().setError(null);
  }, [username, password]);

  const refreshCaptcha = useCallback(() => {
    setCaptcha(createCaptcha());
    setCaptchaInput('');
  }, []);

  const fillDemo = (account: (typeof DEMO_ACCOUNTS)[number]) => {
    setUsername(account.username);
    setPassword(account.password);
    setCaptcha(createCaptcha());
    setCaptchaInput('');
    setLocalError(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalError(null);
    if (!username.trim() || !password) {
      setLocalError('请输入账号与访问密码');
      return;
    }
    if (!isCaptchaValid(captchaInput, captcha)) {
      setLocalError('验证码不正确，请重新输入');
      refreshCaptcha();
      return;
    }
    try {
      await login(username, password, remember);
      navigate(from, { replace: true });
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.status === 403
            ? '该账号已被停用，请联系管理员'
            : error.message
          : '登录失败，请检查 Mock 服务是否启动';
      setLocalError(message);
      refreshCaptcha();
    }
  };

  const particles = useMemo(
    () => PARTICLES.map((item, index) => ({ ...item, index, pos: project(item.lon, item.lat) })),
    [],
  );

  if (token) return <Navigate to="/" replace />;

  return (
    <div className={styles.page}>
      <div className={styles.grid} aria-hidden />
      <header className={styles.header}>
        <div className={styles.brand}>
          <div className={styles.logoMark}>N</div>
          <div>
            <div className={styles.brandName}>NEXUS</div>
            <div className={styles.brandSub}>GLOBAL TRADING COMMAND</div>
          </div>
          <span className={styles.demoBadge}>DEMO / 模拟数据</span>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.guestBadge}>GUEST / 访客</span>
          <span className={styles.headerClock}>
            {formatDate(now)} · {formatClock(now)}
          </span>
        </div>
      </header>

      <main className={styles.body}>
        <section className={styles.hero}>
          <div className={styles.heroKicker}>AUTH-01 / IDENTITY &amp; ACCESS VERIFICATION</div>
          <h1 className={styles.heroTitle}>
            操作员认证
            <span>IDENTITY VERIFICATION</span>
          </h1>
          <p className={styles.heroDesc}>
            使用本地演示账号进入全球交易态势大屏。交易流向、风险指数、节点健康度与资金热力全部为模拟数据，
            用于验证交互密度与演示动线，不构成任何真实交易或投资建议。
          </p>

          <div className={styles.statRow}>
            <div className={styles.stat}>
              <span className={styles.statLabel}>ACTIVE NODES</span>
              <b>30</b>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>FILL RATE</span>
              <b>99.4%</b>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>P99 LATENCY</span>
              <b>92MS</b>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>RISK INDEX</span>
              <b>27.4</b>
            </div>
          </div>

          <div className={styles.worldDecor} aria-hidden>
            <svg viewBox={`0 0 ${WORLD_VIEWBOX.width} ${WORLD_VIEWBOX.height}`} preserveAspectRatio="none">
              <path d={WORLD_OUTLINE} fill="rgba(0,240,255,0.04)" stroke="rgba(0,240,255,0.2)" strokeWidth={0.7} />
              {particles.map((item) => (
                <g key={item.index}>
                  <circle cx={item.pos[0]} cy={item.pos[1]} r={5} fill="rgba(0,240,255,0.05)" />
                  <circle
                    cx={item.pos[0]}
                    cy={item.pos[1]}
                    r={1.8}
                    fill="#00f0ff"
                    opacity={0.8}
                    className={styles.decorPulse}
                    style={{ animationDelay: `${item.index * 0.35}s` }}
                  />
                </g>
              ))}
            </svg>
          </div>
        </section>

        <section className={styles.authPanel} aria-label="登录">
          <div className={styles.panelCode}>SECURE GATEWAY / AUTH-01</div>
          <div className={styles.panelTitleRow}>
            <Fingerprint size={20} className={styles.panelIcon} />
            <h2 className={styles.panelTitle}>登录 NEXUS</h2>
          </div>
          <p className={styles.panelDesc}>输入演示凭据以进入指挥中枢。会话保存在当前浏览器，退出即清除。</p>

          <form className={styles.form} onSubmit={(event) => void handleSubmit(event)} noValidate>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="username">
                <span>账号 / OPERATOR ID</span>
                <span className={styles.labelHint}>REQUIRED</span>
              </label>
              <div className={styles.inputWrap}>
                <UserRound size={13} className={styles.inputIcon} />
                <input
                  id="username"
                  className={styles.input}
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="admin / viewer"
                  autoComplete="username"
                  spellCheck={false}
                  maxLength={32}
                />
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="password">
                <span>访问密码 / ACCESS KEY</span>
                <span className={styles.labelHint}>6-64 CHARS</span>
              </label>
              <div className={styles.inputWrap}>
                <ShieldCheck size={13} className={styles.inputIcon} />
                <input
                  id="password"
                  className={styles.input}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  maxLength={64}
                />
                <button
                  type="button"
                  className={styles.inputAction}
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? '隐藏密码' : '显示密码'}
                >
                  {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="captcha">
                <span>图形验证码 / CAPTCHA</span>
                <span className={styles.labelHint}>LOCAL GENERATED</span>
              </label>
              <div className={styles.captchaRow}>
                <input
                  id="captcha"
                  className={styles.input}
                  value={captchaInput}
                  onChange={(event) => setCaptchaInput(event.target.value.toUpperCase())}
                  placeholder="输入右侧 4 位字符"
                  maxLength={4}
                  autoComplete="off"
                  spellCheck={false}
                />
                <CaptchaCanvas code={captcha} onRefresh={refreshCaptcha} />
              </div>
            </div>

            <div className={styles.optionRow}>
              <label className={styles.remember}>
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                />
                <span>记住我（7 天）</span>
              </label>
              <span className={styles.optionHint}>演示会话 · 浏览器本地</span>
            </div>

            {(localError || storeError) && (
              <div className={styles.error} role="alert">
                {localError ?? storeError}
              </div>
            )}

            <NeonButton variant="primary" type="submit" loading={loading} className={styles.submit}>
              进入 NEXUS 指挥中枢 / ENTER COMMAND SURFACE
            </NeonButton>
          </form>

          <div className={styles.demoBlock}>
            <div className={styles.demoLabel}>演示账号一键填充 / DEMO CREDENTIALS</div>
            <div className={styles.demoRow}>
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.username}
                  type="button"
                  className={styles.demoButton}
                  onClick={() => fillDemo(account)}
                >
                  <span className={styles.demoRole}>{account.role}</span>
                  <span className={styles.demoName}>{account.label}</span>
                  <span className={styles.demoAccount}>
                    {account.username} / {account.password}
                  </span>
                </button>
              ))}
            </div>
            <div className={styles.securityNote}>
              演示鉴权：账号与密码保存在本地 Mock 服务内存，界面不加载任何第三方认证组件。
              <br />
              非真实身份认证 · 非真实交易 · 所有数值均为模拟数据
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <span>NEXUS · DEMO BUILD v1.0 · FLUID VIEWPORT</span>
        <span>NO REAL TRANSACTIONS · MOCK AUTH ONLY</span>
        <span>LOCAL GEOJSON · ZERO EXTERNAL NETWORK</span>
      </footer>
    </div>
  );
}
