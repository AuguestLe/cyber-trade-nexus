import { Router } from 'express';
import { AppError, notFound, validationError } from '../core/errors.js';
import { parseStringParam } from '../core/validate.js';
import { requireRole } from '../middleware/auth.js';

export function createAuthRouter(provider, authenticate) {
  const router = Router();

  router.post('/login', (req, res, next) => {
    try {
      const username = parseStringParam(req.body?.username, 'username', { max: 32 });
      const password = parseStringParam(req.body?.password, 'password', { max: 64 });
      if (!username || !password) throw validationError('账号和密码必填');
      const remember = req.body?.remember === true;

      const user = provider.store.findUserByUsername(username);
      if (!user || user.password !== password) {
        return next(new AppError('INVALID_CREDENTIALS', '账号或密码错误', 401));
      }
      if (!user.enabled) {
        return next(new AppError('USER_DISABLED', '该账号已被停用', 403));
      }

      user.lastLoginAt = Date.now();
      const session = provider.store.createSession(user, remember);
      res.json({
        data: {
          token: session.token,
          expiresAt: session.expiresAt,
          user: provider.store.publicUser(user),
        },
        serverTime: Date.now(),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/session', authenticate, (req, res) => {
    res.json({
      data: { user: req.user, expiresAt: req.session.expiresAt },
      serverTime: Date.now(),
    });
  });

  router.post('/logout', authenticate, (req, res) => {
    provider.store.deleteSession(req.token);
    res.json({ data: { ok: true }, serverTime: Date.now() });
  });

  router.post('/impersonate', authenticate, requireRole('admin'), (req, res, next) => {
    try {
      const userId = parseStringParam(req.body?.userId, 'userId', { max: 32 });
      if (!userId) throw validationError('userId 必填', { field: 'userId' });
      const target = provider.store.findUserById(userId);
      if (!target) {
        return next(notFound('目标用户不存在'));
      }
      if (!target.enabled) {
        return next(new AppError('USER_DISABLED', '目标账号已停用', 403));
      }
      const session = provider.store.createSession(target, false);
      res.json({
        data: {
          token: session.token,
          expiresAt: session.expiresAt,
          user: provider.store.publicUser(target),
        },
        serverTime: Date.now(),
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
