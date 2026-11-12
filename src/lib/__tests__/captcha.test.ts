import { describe, expect, it } from 'vitest';
import { createCaptcha, isCaptchaValid } from '../captcha';

describe('图形验证码', () => {
  it('生成指定长度的大写字符', () => {
    const rng = () => 0;
    const code = createCaptcha(4, rng);
    expect(code).toBe('AAAA');
    expect(code).toHaveLength(4);
    const random = createCaptcha(4, () => 0.5);
    expect(random).toHaveLength(4);
    expect(random).toMatch(/^[A-Z0-9]{4}$/);
  });

  it('校验忽略大小写与空格', () => {
    expect(isCaptchaValid(' abcd ', 'ABCD')).toBe(true);
    expect(isCaptchaValid('ABCD', 'ABCD')).toBe(true);
    expect(isCaptchaValid('ABCE', 'ABCD')).toBe(false);
    expect(isCaptchaValid('', 'ABCD')).toBe(false);
  });
});
