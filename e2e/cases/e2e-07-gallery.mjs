/**
 * E2E-07 作品库加载与排序切换
 *
 * 前置：ensureEditableWork 保证 demo 账号至少有一个可编辑作品（API 创建，幂等）。
 * 断言：作品卡片渲染；排序文案在「最近优先/最早优先」间切换；
 *      切换后列表重新请求（GET /works）且卡片仍渲染。
 */
import { expect } from '../lib/assert.mjs';

export default {
  id: 'E2E-07',
  name: '作品库加载与排序切换',
  run: async ({ page, ctx }) => {
    const tokens = await ctx.loginViaApi();
    await ctx.setAuthStorage(page, tokens);
    // 前置：确保至少一个作品（空则 API 创建）
    const workId = await ctx.ensureEditableWork(ctx.apiUrl, tokens.accessToken);
    expect(workId).toBeTruthy();

    await page.goto(`${ctx.webUrl}/app/gallery`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.work-grid .work-card');

    // 排序按钮初始为「最近优先」
    const sortBtn = page.locator('.view-head button', { hasText: '最近优先' }).first();
    await sortBtn.waitFor({ state: 'visible', timeout: 10000 });

    // 点击切换 → 监听 GET /works 重新请求
    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/works') && r.request().method() === 'GET', { timeout: 10000 }),
      sortBtn.click(),
    ]);
    expect(resp.status()).toBe(200);

    // 文案切换为「最早优先」
    await page.locator('.view-head button', { hasText: '最早优先' }).first().waitFor({ state: 'visible', timeout: 10000 });

    // 卡片仍渲染
    await page.waitForSelector('.work-grid .work-card');
    const cards = await page.$$('.work-grid .work-card');
    expect(cards.length).toBeGreaterThan(0);
  },
};
