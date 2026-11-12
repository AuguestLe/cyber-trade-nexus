import { ApiError } from '@/api/client';
import type { User } from '@/types';
import {
  SEED_MAX,
  SEED_MIN,
  activeAdminCount,
  checkRoleChange,
  checkToggleUser,
  describeAdminError,
  describeAdminFailure,
  generateRandomSeed,
  isBuiltinUser,
  isBuiltinUsername,
  isInjectType,
  isRefreshMs,
  isStreamSpeed,
  normalizeStreamSpeed,
  parseSeedInput,
  validateInjectRequest,
} from '../adminHelpers';

function makeUser(id: string, overrides: Partial<Omit<User, 'id'>> = {}): User {
  return {
    id,
    username: id,
    displayName: `用户·${id}`,
    role: 'viewer',
    enabled: true,
    lastLoginAt: null,
    ...overrides,
  };
}

const adminA = makeUser('a', { username: 'admin', displayName: '管理员 A', role: 'admin' });
const adminB = makeUser('b', { username: 'admin_b', displayName: '管理员 B', role: 'admin' });
const viewer = makeUser('v', { username: 'viewer', displayName: '观察员' });

describe('parseSeedInput', () => {
  it('接受边界内整数并去除首尾空格', () => {
    expect(parseSeedInput(' 20261112 ')).toEqual({ ok: true, seed: 20261112 });
    expect(parseSeedInput(String(SEED_MIN))).toEqual({ ok: true, seed: SEED_MIN });
    expect(parseSeedInput(String(SEED_MAX))).toEqual({ ok: true, seed: SEED_MAX });
  });

  it('拒绝空值、非整数与越界值', () => {
    const empty = parseSeedInput('');
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.error).toContain('不能为空');

    const symbol = parseSeedInput('-1');
    expect(symbol.ok).toBe(false);
    if (!symbol.ok) expect(symbol.error).toContain('纯整数');

    const decimal = parseSeedInput('1.5');
    expect(decimal.ok).toBe(false);
    if (!decimal.ok) expect(decimal.error).toContain('纯整数');

    const zero = parseSeedInput('0');
    expect(zero.ok).toBe(false);
    if (!zero.ok) expect(zero.error).toContain(String(SEED_MIN));

    const overflow = parseSeedInput(String(SEED_MAX + 1));
    expect(overflow.ok).toBe(false);
    if (!overflow.ok) expect(overflow.error).toContain('之间');
  });
});

describe('generateRandomSeed', () => {
  it('把随机源映射到闭区间 [SEED_MIN, SEED_MAX]', () => {
    expect(generateRandomSeed(() => 0)).toBe(SEED_MIN);
    expect(generateRandomSeed(() => 1)).toBe(SEED_MAX);
    const middle = generateRandomSeed(() => 0.5);
    expect(middle).toBeGreaterThanOrEqual(SEED_MIN);
    expect(middle).toBeLessThanOrEqual(SEED_MAX);
  });

  it('非法随机源回退到最小种子', () => {
    expect(generateRandomSeed(() => Number.NaN)).toBe(SEED_MIN);
    expect(generateRandomSeed(() => -1)).toBe(SEED_MIN);
  });
});

describe('validateInjectRequest', () => {
  it('仅接受三种 PRD 定义的注入类型', () => {
    expect(isInjectType('large_trade')).toBe(true);
    expect(isInjectType('latency_spike')).toBe(true);
    expect(isInjectType('risk_hit')).toBe(true);
    expect(isInjectType('node_offline')).toBe(false);

    const valid = validateInjectRequest({ type: 'risk_hit' });
    expect(valid.ok).toBe(true);
    if (valid.ok) expect(valid.payload).toEqual({ type: 'risk_hit' });

    const invalid = validateInjectRequest({ type: 'node_offline' });
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(invalid.error).toContain('不支持的注入类型');
  });

  it('可选资产类别与节点会被校验并裁掉首尾空格', () => {
    const result = validateInjectRequest({
      type: 'large_trade',
      assetClass: 'crypto',
      nodeId: '  n_sh ',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload).toEqual({ type: 'large_trade', assetClass: 'crypto', nodeId: 'n_sh' });
    }

    const badAsset = validateInjectRequest({ type: 'large_trade', assetClass: 'stock' });
    expect(badAsset.ok).toBe(false);

    const longNode = validateInjectRequest({ type: 'latency_spike', nodeId: 'x'.repeat(33) });
    expect(longNode.ok).toBe(false);
    if (!longNode.ok) expect(longNode.error).toContain('32');

    const blankNode = validateInjectRequest({ type: 'latency_spike', nodeId: '   ' });
    expect(blankNode.ok).toBe(true);
    if (blankNode.ok) expect(blankNode.payload.nodeId).toBeUndefined();
  });
});

describe('activeAdminCount / 用户保护规则', () => {
  it('统计启用状态的管理员', () => {
    expect(activeAdminCount([adminA, adminB, viewer])).toBe(2);
    expect(activeAdminCount([{ ...adminA, enabled: false }, viewer])).toBe(0);
  });

  it('禁止停用最后一名启用管理员', () => {
    const check = checkToggleUser([adminA, viewer], adminA.id, false);
    expect(check.allowed).toBe(false);
    expect(check.reason).toBe('LAST_ADMIN');
    expect(check.message).toContain('至少一个启用状态的管理员');
  });

  it('存在第二名管理员时允许停用', () => {
    const check = checkToggleUser([adminA, adminB, viewer], adminA.id, false);
    expect(check.allowed).toBe(true);
    expect(check.reason).toBeNull();
  });

  it('启停普通用户不受保护规则限制', () => {
    const check = checkToggleUser([adminA, viewer], viewer.id, false);
    expect(check.allowed).toBe(true);
  });

  it('目标用户不存在时返回 USER_NOT_FOUND', () => {
    const check = checkToggleUser([adminA, viewer], 'ghost', false);
    expect(check.allowed).toBe(false);
    expect(check.reason).toBe('USER_NOT_FOUND');
  });

  it('禁止修改自己的角色（优先于其他规则）', () => {
    const users = [adminA, adminB, viewer];
    const check = checkRoleChange(users, adminA.id, adminA.id, 'viewer');
    expect(check.allowed).toBe(false);
    expect(check.reason).toBe('SELF_ROLE');
  });

  it('允许自己保持原角色', () => {
    const check = checkRoleChange([adminA, viewer], adminA.id, adminA.id, 'admin');
    expect(check.allowed).toBe(true);
  });

  it('禁止降级最后一名启用管理员', () => {
    const check = checkRoleChange([adminA, viewer], 'outsider', adminA.id, 'viewer');
    expect(check.allowed).toBe(false);
    expect(check.reason).toBe('LAST_ADMIN');
  });

  it('存在第二名管理员时允许降级其中一名', () => {
    const check = checkRoleChange([adminA, adminB, viewer], adminA.id, adminB.id, 'viewer');
    expect(check.allowed).toBe(true);
  });

  it('允许将 viewer 提升为 admin', () => {
    const check = checkRoleChange([adminA, viewer], adminA.id, viewer.id, 'admin');
    expect(check.allowed).toBe(true);
  });

  it('角色切换同样校验目标是否存在', () => {
    const check = checkRoleChange([adminA, viewer], adminA.id, 'ghost', 'viewer');
    expect(check.allowed).toBe(false);
    expect(check.reason).toBe('USER_NOT_FOUND');
  });
});

describe('内置账号徽章', () => {
  it('仅将 admin / viewer 视为内置账号', () => {
    expect(isBuiltinUsername('admin')).toBe(true);
    expect(isBuiltinUsername('viewer')).toBe(true);
    expect(isBuiltinUsername('trader_li')).toBe(false);
    expect(isBuiltinUser({ username: 'admin' })).toBe(true);
    expect(isBuiltinUser({ username: 'analyst_zhao' })).toBe(false);
  });
});

describe('错误文案映射', () => {
  it('将服务端 details.reason 翻译成友好提示', () => {
    const lastAdmin = describeAdminFailure(
      'VALIDATION_ERROR',
      { reason: 'LAST_ADMIN' },
      '必须保留至少一个启用状态的管理员',
      '更新失败',
    );
    expect(lastAdmin).toContain('至少一个启用状态的管理员');

    const selfRole = describeAdminFailure('VALIDATION_ERROR', { reason: 'SELF_ROLE' }, '', '更新失败');
    expect(selfRole).toContain('不能修改自己的角色');
  });

  it('为常见错误码提供兜底文案', () => {
    expect(describeAdminFailure('NETWORK_ERROR', null, '', '失败')).toContain('无法连接 Mock 服务');
    expect(describeAdminFailure('USER_DISABLED', null, '', '失败')).toContain('停用');
    expect(describeAdminFailure('UNAUTHORIZED', null, '', '失败')).toContain('重新登录');
    expect(describeAdminFailure('FORBIDDEN', null, '', '失败')).toContain('无此操作权限');
  });

  it('未知错误码优先使用服务端可读 message，其次使用 fallback', () => {
    expect(describeAdminFailure('VALIDATION_ERROR', null, '节点 ID 长度不得超过 32 个字符', '失败')).toBe(
      '节点 ID 长度不得超过 32 个字符',
    );
    expect(describeAdminFailure('INTERNAL_ERROR', null, '  ', '操作失败')).toBe('操作失败');
  });

  it('describeAdminError 识别 ApiError 并读取 details', () => {
    const error = new ApiError('VALIDATION_ERROR', '不能修改自己的角色', 400, { reason: 'SELF_ROLE' });
    expect(describeAdminError(error, '兜底')).toContain('不能修改自己的角色');
    expect(describeAdminError(new Error('boom'), '兜底')).toBe('兜底');
    expect(describeAdminError('boom', '兜底')).toBe('兜底');
  });
});

describe('速率与刷新枚举', () => {
  it('仅接受 0.5 / 1 / 2 / 4 四档速率', () => {
    expect(isStreamSpeed(0.5)).toBe(true);
    expect(isStreamSpeed(1)).toBe(true);
    expect(isStreamSpeed(2)).toBe(true);
    expect(isStreamSpeed(4)).toBe(true);
    expect(isStreamSpeed(1.5)).toBe(false);
    expect(isStreamSpeed(8)).toBe(false);
  });

  it('非法速率回退到 1×', () => {
    expect(normalizeStreamSpeed(undefined)).toBe(1);
    expect(normalizeStreamSpeed(null)).toBe(1);
    expect(normalizeStreamSpeed(1.5)).toBe(1);
    expect(normalizeStreamSpeed(4)).toBe(4);
  });

  it('刷新频率只接受 1s / 2s / 5s', () => {
    expect(isRefreshMs(1000)).toBe(true);
    expect(isRefreshMs(2000)).toBe(true);
    expect(isRefreshMs(5000)).toBe(true);
    expect(isRefreshMs(1500)).toBe(false);
    expect(isRefreshMs(3000)).toBe(false);
  });
});
