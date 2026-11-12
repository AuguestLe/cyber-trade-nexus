import { ApiError } from '@/api/client';
import type { AssetClass, InjectType, Role, StreamSpeed, User } from '@/types';

/** PRD / 接口文档约定的种子范围。 */
export const SEED_MIN = 1;
export const SEED_MAX = 2_147_483_646;

/** 服务端仅接受这四个速率。 */
export const STREAM_SPEEDS: readonly StreamSpeed[] = [0.5, 1, 2, 4];

/** PRD 仅定义三类可注入异常，不包含 node_offline。 */
export const INJECT_TYPES: readonly InjectType[] = ['large_trade', 'latency_spike', 'risk_hit'];

export const ASSET_CLASSES: readonly AssetClass[] = ['fx', 'equity', 'crypto', 'bond', 'commodity'];

export const REFRESH_VALUES: readonly (1000 | 2000 | 5000)[] = [1000, 2000, 5000];

export type SeedParseResult =
  | { ok: true; seed: number }
  | { ok: false; error: string };

/** 输入框种子校验：纯整数且在 [1, 2147483646] 内。 */
export function parseSeedInput(raw: string): SeedParseResult {
  const text = raw.trim();
  if (!text) {
    return { ok: false, error: `SEED 不能为空，请输入 ${SEED_MIN}~${SEED_MAX} 的整数` };
  }
  if (!/^\d+$/.test(text)) {
    return { ok: false, error: 'SEED 必须是纯整数（不含符号、空格或小数）' };
  }
  const seed = Number(text);
  if (!Number.isSafeInteger(seed) || seed < SEED_MIN || seed > SEED_MAX) {
    return { ok: false, error: `SEED 必须在 ${SEED_MIN}~${SEED_MAX} 之间` };
  }
  return { ok: true, seed };
}

/** 在合法区间内生成随机种子；传入的随机源便于单测固定结果。 */
export function generateRandomSeed(rand: () => number = Math.random): number {
  const raw = rand();
  if (!Number.isFinite(raw)) return SEED_MIN;
  if (raw >= 1) return SEED_MAX;
  const ratio = Math.max(raw, 0);
  return Math.min(SEED_MAX, Math.max(SEED_MIN, Math.floor(ratio * SEED_MAX) + SEED_MIN));
}

export interface InjectValidationInput {
  type: string;
  assetClass?: string | null;
  nodeId?: string | null;
}

export interface ValidInjectRequest {
  type: InjectType;
  assetClass?: AssetClass;
  nodeId?: string;
}

export type InjectValidationResult =
  | { ok: true; payload: ValidInjectRequest }
  | { ok: false; error: string };

export function isInjectType(value: string): value is InjectType {
  return INJECT_TYPES.some((item) => item === value);
}

export function isAssetClass(value: string): value is AssetClass {
  return ASSET_CLASSES.some((item) => item === value);
}

export function isStreamSpeed(value: number): value is StreamSpeed {
  return STREAM_SPEEDS.some((item) => item === value);
}

export function normalizeStreamSpeed(value: number | null | undefined): StreamSpeed {
  return typeof value === 'number' && isStreamSpeed(value) ? value : 1;
}

export function isRefreshMs(value: number): value is 1000 | 2000 | 5000 {
  return REFRESH_VALUES.some((item) => item === value);
}

/** 注入参数校验：类型必须受支持，资产类别/节点为可选但需合法。 */
export function validateInjectRequest(input: InjectValidationInput): InjectValidationResult {
  if (!isInjectType(input.type)) {
    return { ok: false, error: '不支持的注入类型，仅允许大额交易 / 延迟尖峰 / 风控命中' };
  }

  const payload: ValidInjectRequest = { type: input.type };

  if (input.assetClass != null && input.assetClass !== '') {
    if (!isAssetClass(input.assetClass)) {
      return { ok: false, error: '资产类别不合法，仅允许 fx / equity / crypto / bond / commodity' };
    }
    payload.assetClass = input.assetClass;
  }

  if (input.nodeId != null) {
    const nodeId = input.nodeId.trim();
    if (nodeId.length > 32) {
      return { ok: false, error: '节点 ID 长度不得超过 32 个字符' };
    }
    if (nodeId) payload.nodeId = nodeId;
  }

  return { ok: true, payload };
}

export type UserRuleReason = 'LAST_ADMIN' | 'SELF_ROLE' | 'USER_NOT_FOUND';

export interface UserRuleCheck {
  allowed: boolean;
  reason: UserRuleReason | null;
  message: string;
}

const RULE_MESSAGES: Record<UserRuleReason, string> = {
  LAST_ADMIN: '必须保留至少一个启用状态的管理员，无法停用或降级最后一名管理员',
  SELF_ROLE: '不能修改自己的角色，请让其他管理员操作',
  USER_NOT_FOUND: '目标用户不存在，请刷新用户列表',
};

const ALLOWED: UserRuleCheck = { allowed: true, reason: null, message: '' };

function blocked(reason: UserRuleReason): UserRuleCheck {
  return { allowed: false, reason, message: RULE_MESSAGES[reason] };
}

export function activeAdminCount(users: readonly User[]): number {
  return users.filter((user) => user.role === 'admin' && user.enabled).length;
}

/** 启停保护：最后一名启用管理员不可停用；其余情况交给服务端裁决。 */
export function checkToggleUser(
  users: readonly User[],
  targetId: string,
  nextEnabled: boolean,
): UserRuleCheck {
  const target = users.find((user) => user.id === targetId);
  if (!target) return blocked('USER_NOT_FOUND');
  if (
    !nextEnabled &&
    target.enabled &&
    target.role === 'admin' &&
    activeAdminCount(users) <= 1
  ) {
    return blocked('LAST_ADMIN');
  }
  return ALLOWED;
}

/** 角色保护：不可修改自身角色；不可降级最后一名启用管理员。 */
export function checkRoleChange(
  users: readonly User[],
  actorId: string,
  targetId: string,
  nextRole: Role,
): UserRuleCheck {
  const target = users.find((user) => user.id === targetId);
  if (!target) return blocked('USER_NOT_FOUND');
  if (target.id === actorId && nextRole !== target.role) return blocked('SELF_ROLE');
  if (
    target.enabled &&
    target.role === 'admin' &&
    nextRole !== 'admin' &&
    activeAdminCount(users) <= 1
  ) {
    return blocked('LAST_ADMIN');
  }
  return ALLOWED;
}

/** 内置账号（admin / viewer）用于列表徽章，不暴露密码。 */
export function isBuiltinUsername(username: string): boolean {
  return username === 'admin' || username === 'viewer';
}

export function isBuiltinUser(user: Pick<User, 'username'>): boolean {
  return isBuiltinUsername(user.username);
}

/**
 * 把服务端 400 + details.reason 或通用错误码翻译成可读提示。
 * 纯函数，便于单测；组件只需传入 ApiError 的字段。
 */
export function describeAdminFailure(
  code: string,
  details: Record<string, unknown> | null,
  message: string,
  fallback: string,
): string {
  const reason = typeof details?.reason === 'string' ? details.reason : null;
  if (reason && reason in RULE_MESSAGES) {
    return RULE_MESSAGES[reason as UserRuleReason];
  }
  switch (code) {
    case 'NETWORK_ERROR':
      return '无法连接 Mock 服务，请确认 API 进程已启动';
    case 'USER_DISABLED':
      return '该账号已被停用，无法继续操作';
    case 'UNAUTHORIZED':
    case 'TOKEN_EXPIRED':
      return '会话已失效，请重新登录';
    case 'FORBIDDEN':
      return '当前身份无此操作权限';
    default:
      break;
  }
  const text = message.trim();
  return text || fallback;
}

/** 组件统一错误入口：ApiError 走字段映射，其余走兜底文案。 */
export function describeAdminError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return describeAdminFailure(error.code, error.details, error.message, fallback);
  }
  return fallback;
}
