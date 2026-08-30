/**
 * E2E-03 demo 登录流程
 * 断言：跳转 /app/dashboard；应用区可见（侧栏/页面标题）；localStorage token 写入。
 */
import { expect } from '../lib/assert.mjs';

export default {
  id: 'E2E-03',
  name: 'demo 登录流程',
  run: async ({ page, ctx }) => {
    await page.goto(`${ctx.webUrl}/login`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.auth-form input[type="email"]');
    await page.fill('.auth-form input[type="email"]', 'demo@mira.app');
    await page.fill('.auth-form input[type="password"]', 'Passw0rd!');
    await page.click('.auth-form button[type="submit"]');
    // 跳转 dashboard + 应用区可见
    await page.waitForURL((url) => url.pathname === '/app/dashboard', { timeout: 15000 });
    await page.waitForSelector('.topbar-title');
    const topbar = (await page.textContent('.topbar-title')) || '';
    expect(topbar).toContain('工作台');
    await page.waitForSelector('.side-nav .nav-item', { timeout: 10000 });
    // localStorage token 已写入
    const tokens = await page.evaluate(() => ({
      access: localStorage.getItem('mira_access_token'),
      refresh: localStorage.getItem('mira_refresh_token'),
    }));
    expect(tokens.access).toBeTruthy();
    expect(tokens.refresh).toBeTruthy();
  },
};
