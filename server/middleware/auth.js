import { AppError, forbidden, unauthorized } from '../core/errors.js';

/**
 * 演示鉴权：token 存于内存，非真实安全机制。
 * 支持 Authorization: Bearer 与 SSE 的 query token。
 */
export function createAuthMiddleware(provider) {
  return function authenticate(req, _res, next) {
    const header = req.get('authorization') ?? '';
    const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    const token = bearer || (typeof req.query.token === 'string' ? req.query.token : '');
    if (!token) return next(unauthorized());
    const session = provider.store.getSession(token);
    if (!session) {
      return next(new AppError('TOKEN_EXPIRED', '会话已过期，请重新登录', 401));
    }
    req.session = session;
    req.user = session.user;
    req.token = token;
    req.authenticate = authenticate;
    return next();
  };
}

export function requireRole(role) {
  return function roleGuard(req, _res, next) {
    if (!req.user) return next(unauthorized());
    if (req.user.role !== role) {
      return next(forbidden(`该操作仅限 ${role} 角色`));
    }
    return next();
  };
}
