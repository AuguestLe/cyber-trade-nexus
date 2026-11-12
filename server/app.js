import express from 'express';
import { randomUUID } from 'node:crypto';
import { AppError } from './core/errors.js';
import { createAuthMiddleware } from './middleware/auth.js';
import { createAuthRouter } from './routes/auth.js';
import { createAdminRouter } from './routes/admin.js';
import { createDataRouter } from './routes/data.js';

export function createApp(provider) {
  const app = express();
  app.disable('x-powered-by');

  app.use((req, res, next) => {
    const requestId = `req_${randomUUID().slice(0, 8)}`;
    req.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  });

  app.use(express.json({ limit: '32kb' }));

  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      // 只记录方法与状态，不记录请求体，避免凭据泄漏
      console.log(`[api] ${req.method} ${req.originalUrl.split('?')[0]} ${res.statusCode} ${duration}ms ${req.requestId ?? ''}`);
    });
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      data: { ok: true, uptimeMs: Date.now() - provider.store.startedAt, version: '1.0.0' },
      serverTime: Date.now(),
    });
  });

  const authenticate = createAuthMiddleware(provider);

  app.use('/api/auth', createAuthRouter(provider, authenticate));
  app.use('/api/admin', createAdminRouter(provider, authenticate));
  app.use('/api', createDataRouter(provider, authenticate));

  app.use('/api', (req, res) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `接口 ${req.method} ${req.originalUrl.split('?')[0]} 不存在`,
        requestId: req.requestId,
      },
      serverTime: Date.now(),
    });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, _next) => {
    const isJsonParse = err instanceof SyntaxError && err.status === 400 && 'body' in err;
    const appError = err instanceof AppError
      ? err
      : isJsonParse
        ? new AppError('VALIDATION_ERROR', '请求体 JSON 格式非法', 400)
        : new AppError('INTERNAL_ERROR', '服务内部错误', 500);

    if (!(err instanceof AppError) && !isJsonParse) {
      console.error(`[error] ${req.requestId ?? ''} ${err?.stack ?? err}`);
    }
    res.status(appError.status).json({
      error: {
        code: appError.code,
        message: appError.message,
        details: appError.details ?? null,
        requestId: req.requestId,
      },
      serverTime: Date.now(),
    });
  });

  return app;
}
