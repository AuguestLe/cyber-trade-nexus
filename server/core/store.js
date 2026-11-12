import { EventEmitter } from 'node:events';
import { randomBytes } from 'node:crypto';
import { CONFIG } from '../config.js';
import { DEMO_USERS } from './seed.js';

/**
 * 进程内业务存储：交易、告警、行情、用户、会话。
 * 所有写入自增 version，供聚合缓存失效；数组有硬上限，保证长跑内存稳定。
 */
export class MockStore {
  constructor() {
    this.trades = [];
    this.alerts = [];
    this.markets = [];
    this.users = DEMO_USERS.map((user) => ({ ...user }));
    this.sessions = new Map();
    this.version = 0;
    this.seed = CONFIG.seed;
    this.startedAt = Date.now();
    this.clients = 0;
    this.stream = { paused: false, speed: 1, intervalMs: CONFIG.defaultIntervalMs };
    this.bus = new EventEmitter();
    this.bus.setMaxListeners(100);
  }

  bootstrap({ trades = [], alerts = [], markets = [] }) {
    this.trades = trades.slice(-CONFIG.tradeCap);
    this.alerts = alerts.slice(-CONFIG.alertCap);
    this.markets = markets;
    this.version += 1;
  }

  addTrade(trade) {
    this.trades.unshift(trade);
    if (this.trades.length > CONFIG.tradeCap) this.trades.length = CONFIG.tradeCap;
    this.version += 1;
    this.emit('trade', trade);
  }

  addAlert(alert) {
    this.alerts.unshift(alert);
    if (this.alerts.length > CONFIG.alertCap) this.alerts.length = CONFIG.alertCap;
    this.version += 1;
    this.emit('alert', alert);
  }

  handleAlert(id, handled = true, now = Date.now()) {
    const alert = this.alerts.find((item) => item.id === id);
    if (!alert) return null;
    alert.handled = handled;
    alert.handledAt = handled ? now : null;
    this.version += 1;
    this.emit('alert-handled', alert);
    return alert;
  }

  clear() {
    const cleared = { trades: this.trades.length, alerts: this.alerts.length };
    this.trades = [];
    this.alerts = [];
    this.version += 1;
    return cleared;
  }

  setMarkets(markets) {
    this.markets = markets;
    this.version += 1;
  }

  setStream(partial) {
    this.stream = { ...this.stream, ...partial };
    if (typeof partial.speed === 'number') {
      this.stream.intervalMs = Math.round(CONFIG.defaultIntervalMs / this.stream.speed);
    }
    this.emit('status', this.streamStatus());
    return this.streamStatus();
  }

  streamStatus() {
    return {
      paused: this.stream.paused,
      speed: this.stream.speed,
      intervalMs: this.stream.intervalMs,
      clients: this.clients,
      uptimeMs: Date.now() - this.startedAt,
    };
  }

  setSeed(seed) {
    this.seed = seed;
  }

  addClient() {
    this.clients += 1;
    this.emit('status', this.streamStatus());
  }

  removeClient() {
    this.clients = Math.max(0, this.clients - 1);
    this.emit('status', this.streamStatus());
  }

  listUsers() {
    return this.users.map((user) => this.publicUser(user));
  }

  findUserByUsername(username) {
    return this.users.find((user) => user.username === username) ?? null;
  }

  findUserById(id) {
    return this.users.find((user) => user.id === id) ?? null;
  }

  publicUser(user) {
    if (!user) return null;
    const { password: _password, ...rest } = user;
    return rest;
  }

  updateUser(id, patch) {
    const user = this.findUserById(id);
    if (!user) return null;
    Object.assign(user, patch);
    if (patch.enabled === false) this.dropUserSessions(id);
    return this.publicUser(user);
  }

  createSession(user, remember = false, now = Date.now()) {
    const ttl = remember ? CONFIG.sessionTtlRemember : CONFIG.sessionTtl;
    const token = `nx_${randomBytes(24).toString('base64url')}`;
    this.sessions.set(token, { userId: user.id, createdAt: now, expiresAt: now + ttl });
    return { token, expiresAt: now + ttl };
  }

  getSession(token, now = Date.now()) {
    const session = this.sessions.get(token);
    if (!session) return null;
    if (session.expiresAt <= now) {
      this.sessions.delete(token);
      return null;
    }
    const user = this.findUserById(session.userId);
    if (!user || !user.enabled) {
      this.sessions.delete(token);
      return null;
    }
    return { ...session, user: this.publicUser(user) };
  }

  deleteSession(token) {
    return this.sessions.delete(token);
  }

  dropUserSessions(userId) {
    for (const [token, session] of this.sessions.entries()) {
      if (session.userId === userId) this.sessions.delete(token);
    }
  }

  emit(type, data) {
    this.bus.emit('event', type, data);
  }

  subscribe(listener) {
    this.bus.on('event', listener);
    return () => this.bus.off('event', listener);
  }

  meta() {
    return {
      demo: true,
      seed: this.seed,
      version: CONFIG.version,
      startedAt: this.startedAt,
      stream: {
        paused: this.stream.paused,
        speed: this.stream.speed,
        intervalMs: this.stream.intervalMs,
      },
      clients: this.clients,
    };
  }
}
