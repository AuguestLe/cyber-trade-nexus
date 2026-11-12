const CAPTCHA_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** 生成 4 位图形验证码（本地校验，纯演示用途）。 */
export function createCaptcha(length = 4, rng: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += CAPTCHA_CHARS[Math.floor(rng() * CAPTCHA_CHARS.length)];
  }
  return code;
}

export function isCaptchaValid(input: string, code: string): boolean {
  return input.trim().toUpperCase() === code.toUpperCase();
}
