import type { ConnectionState } from '@/types';

export type StreamEventName =
  | 'hello'
  | 'trade'
  | 'alert'
  | 'kpi'
  | 'market'
  | 'status'
  | 'heartbeat';

export interface StreamHandlers {
  onEvent(event: StreamEventName, data: unknown): void;
  onConnection(state: ConnectionState): void;
}

const EVENT_NAMES: StreamEventName[] = ['hello', 'trade', 'alert', 'kpi', 'market', 'status', 'heartbeat'];

/**
 * SSE 单例：指数退避重连，页面退到后台时保持连接，回前台确保存活。
 */
export class StreamClient {
  private source: EventSource | null = null;
  private token: string | null = null;
  private handlers: StreamHandlers | null = null;
  private retryTimer: number | null = null;
  private retries = 0;
  private stopped = true;
  private visibilityBound = false;

  start(token: string, handlers: StreamHandlers): void {
    if (!token) return;
    if (this.token === token && this.source) return;
    this.stop();
    this.token = token;
    this.handlers = handlers;
    this.stopped = false;
    this.retries = 0;
    this.connect();
    if (!this.visibilityBound) {
      document.addEventListener('visibilitychange', this.onVisibility);
      this.visibilityBound = true;
    }
  }

  stop(): void {
    this.stopped = true;
    this.clearRetry();
    this.closeSource();
    this.token = null;
    this.handlers = null;
    if (this.visibilityBound) {
      document.removeEventListener('visibilitychange', this.onVisibility);
      this.visibilityBound = false;
    }
  }

  /** 强制重连（例如用户点击“重连”）。 */
  reconnect(): void {
    if (!this.token || !this.handlers) return;
    this.clearRetry();
    this.closeSource();
    this.retries = 0;
    this.connect();
  }

  private onVisibility = () => {
    if (document.visibilityState === 'visible' && !this.source && !this.stopped && this.token) {
      this.retries = 0;
      this.connect();
    }
  };

  private connect(): void {
    if (this.stopped || !this.token || !this.handlers) return;
    this.handlers.onConnection('connecting');
    const source = new EventSource(`/api/stream?token=${encodeURIComponent(this.token)}`);
    this.source = source;

    source.onopen = () => {
      this.retries = 0;
      this.handlers?.onConnection('open');
    };

    source.onerror = () => {
      if (this.stopped) return;
      this.closeSource();
      this.scheduleRetry();
    };

    for (const name of EVENT_NAMES) {
      source.addEventListener(name, (event) => {
        try {
          const data = JSON.parse((event as MessageEvent<string>).data) as unknown;
          this.handlers?.onEvent(name, data);
        } catch {
          /* 忽略非法帧，保持连接 */
        }
      });
    }
  }

  private scheduleRetry(): void {
    this.retries += 1;
    const delay = Math.min(8000, 1000 * 2 ** Math.min(this.retries - 1, 3));
    this.handlers?.onConnection('retrying');
    this.clearRetry();
    this.retryTimer = window.setTimeout(() => this.connect(), delay);
  }

  private clearRetry(): void {
    if (this.retryTimer != null) {
      window.clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  private closeSource(): void {
    if (this.source) {
      this.source.close();
      this.source = null;
    }
  }
}

export const streamClient = new StreamClient();
