import { Router } from 'express';
import { ROLES } from '../config.js';
import { notFound, validationError } from '../core/errors.js';
import {
  parseBooleanParam,
  parseEnum,
  parseInjectBody,
  parseSeed,
  parseStringParam,
} from '../core/validate.js';
import { requireRole } from '../middleware/auth.js';

function send(res, data) {
  return res.json({ data, serverTime: Date.now() });
}

export function createAdminRouter(provider, authenticate) {
  const router = Router();
  router.use(authenticate, requireRole('admin'));

  router.get('/users', (_req, res) => {
    const items = provider.store.listUsers().sort((a, b) => {
      if (a.role !== b.role) return a.role === 'admin' ? -1 : 1;
      return (b.lastLoginAt ?? 0) - (a.lastLoginAt ?? 0);
    });
    send(res, { items });
  });

  router.patch('/users/:id', (req, res) => {
    const user = provider.store.findUserById(req.params.id);
    if (!user) throw notFound('用户不存在');

    const patch = {};
    if (req.body?.enabled !== undefined) {
      patch.enabled = parseBooleanParam(req.body.enabled, 'enabled');
    }
    if (req.body?.role !== undefined) {
      patch.role = parseEnum(req.body.role, ROLES, 'role');
    }
    if (Object.keys(patch).length === 0) {
      throw validationError('至少提供一个可修改字段：enabled / role');
    }

    if (patch.role && user.id === req.user.id && patch.role !== user.role) {
      throw validationError('不能修改自己的角色', { reason: 'SELF_ROLE' });
    }

    const losingAdmin =
      user.role === 'admin' &&
      user.enabled &&
      (patch.enabled === false || (patch.role && patch.role !== 'admin'));
    if (losingAdmin) {
      const activeAdmins = provider.store.users.filter((item) => item.role === 'admin' && item.enabled);
      if (activeAdmins.length <= 1) {
        throw validationError('必须保留至少一个启用状态的管理员', { reason: 'LAST_ADMIN' });
      }
    }

    const updated = provider.store.updateUser(user.id, patch);
    return send(res, { user: updated });
  });

  router.patch('/stream', (req, res) => {
    const body = req.body ?? {};
    const paused = parseBooleanParam(body.paused, 'paused', null);
    const speed = body.speed == null ? null : Number(body.speed);
    if (paused == null && speed == null) {
      throw validationError('至少提供 paused 或 speed');
    }
    if (speed != null && ![0.5, 1, 2, 4].includes(speed)) {
      throw validationError('speed 只允许 0.5 / 1 / 2 / 4', { field: 'speed', value: body.speed });
    }
    const result = provider.control({
      type: 'stream',
      ...(paused == null ? {} : { paused }),
      ...(speed == null ? {} : { speed }),
    });
    send(res, { stream: result.stream });
  });

  router.post('/inject', (req, res) => {
    const body = parseInjectBody(req.body);
    const result = provider.control({
      type: 'inject',
      injectType: body.type,
      assetClass: body.assetClass,
      nodeId: body.nodeId,
    });
    send(res, { created: result.created });
  });

  router.post('/reset', (req, res) => {
    const seed = parseSeed(req.body?.seed ?? req.query.seed);
    const result = provider.control({ type: 'reset', seed });
    send(res, result);
  });

  router.post('/clear', (_req, res) => {
    const result = provider.control({ type: 'clear' });
    send(res, result);
  });

  router.patch('/alerts/:id', (req, res) => {
    const handled = parseBooleanParam(req.body?.handled, 'handled');
    if (handled == null) throw validationError('handled 必填', { field: 'handled' });
    const result = provider.control({
      type: 'handleAlert',
      alertId: req.params.id,
      handled,
    });
    if (!result) throw notFound('告警不存在');
    send(res, result);
  });

  router.get('/users/:id', (req, res) => {
    const user = provider.store.findUserById(req.params.id);
    if (!user) throw notFound('用户不存在');
    send(res, { user: provider.store.publicUser(user) });
  });

  return router;
}
