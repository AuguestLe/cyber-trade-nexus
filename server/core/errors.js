export class AppError extends Error {
  constructor(code, message, status = 400, details = null) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function validationError(message, details = null) {
  return new AppError('VALIDATION_ERROR', message, 400, details);
}

export function unauthorized(message = '未登录或会话已失效') {
  return new AppError('UNAUTHORIZED', message, 401);
}

export function forbidden(message = '当前账号无权访问该资源') {
  return new AppError('FORBIDDEN', message, 403);
}

export function notFound(message = '目标资源不存在') {
  return new AppError('NOT_FOUND', message, 404);
}
