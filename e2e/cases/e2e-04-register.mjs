/**
 * E2E-04 新用户注册流程（随机邮箱，无验证码）
 * 断言：注册成功自动登录进入应用区；localStorage token 写入。
 */
import { expect } from '../lib/assert.mjs';

export default {
  id: 'E2E-04',
  name: '新用户注册流程',
  run: async ({ page, ctx }) => {
    const email = `e2e_${Date.now()}@mira.test`;
    const password = 'E2eTest123';
    await page.goto(`${ctx.webUrl}/register`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.auth-form');
    // 邮箱 / 密码 / 确认密码（第 2 个 password 输入）
    await page.fill('.auth-form input[type="email"]', email);
    const pwInputs = page.locator('.auth-form input[type="password"]');
    await pwInputs.nth(0).fill(password);
    await pwInputs.nth(1).fill(password);
    await page.click('.auth-form button[type="submit"]');
    // 注册成功自动登录进入应用区（后端无邮箱验证/验证码）
    await page.waitForURL((url) => url.pathname.startsWith('/app/'), { timeout: 15000 });
    await page.waitForSelector('.topbar-title');
    const tokens = await page.evaluate(() => ({
      access: localStorage.getItem('mira_access_token'),
      refresh: localStorage.getItem('mira_refresh_token'),
    }));
    expect(tokens.access).toBeTruthy();
    expect(tokens.refresh).toBeTruthy();
  },
};
