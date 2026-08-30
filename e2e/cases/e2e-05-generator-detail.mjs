/**
 * E2E-05 生成页浏览 + 案例详情大图 + 套用提示词（与 R9 联动）
 *
 * 注意：不点击「✨ 生成设计」，避免触发 NVIDIA 上游生成（429/500 波动导致 flaky）；
 * 生成链路回归由 scripts/smoke.mjs 承担。
 *
 * 断言：描述可输入；模板库/案例库可见；点击案例卡片 → 详情面板展开、
 *      标题匹配、详情大图加载成功（naturalWidth>0）、提示词文本可见；
 *      点「套用此提示词」→ 描述框回填为该案例 prompt。
 */
import { expect } from '../lib/assert.mjs';

export default {
  id: 'E2E-05',
  name: '生成页浏览 + 案例详情大图 + 套用提示词',
  run: async ({ page, ctx }) => {
    // 注入 demo 登录态（RequireAuth 校验 token 有效）
    const tokens = await ctx.loginViaApi();
    await ctx.setAuthStorage(page, tokens);
    await page.goto(`${ctx.webUrl}/app/generator`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.gen-stage textarea.input');

    // 1) 描述可输入
    const desc = '咖啡店开业海报，暖色调，手绘风';
    await page.fill('.gen-stage textarea.input', desc);
    const val = await page.inputValue('.gen-stage textarea.input');
    expect(val).toBe(desc);

    // 2) 模板库可见
    await page.waitForSelector('.tpl-picker-grid .tpl-pick-card');
    const tplCards = await page.$$('.tpl-picker-grid .tpl-pick-card');
    expect(tplCards.length).toBeGreaterThan(0);

    // 3) 案例库可见
    await page.waitForSelector('.case-grid .case-card');
    const caseCards = await page.$$('.case-grid .case-card');
    expect(caseCards.length).toBeGreaterThan(0);

    // 4) 点击第一个案例卡片 → 详情面板展开
    await page.click('.case-grid .case-card');
    await page.waitForSelector('.case-detail');
    await page.waitForSelector('.case-detail-title');
    const caseTitle = (await page.textContent('.case-detail-title')) || '';
    expect(caseTitle.length).toBeGreaterThan(0);

    // 详情大图加载成功（R9 高清优先；CDN/raw 失败回退本地缩略图同样 naturalWidth>0）
    await ctx.assertImgLoaded(page, '.case-detail img.case-detail-img', 20000);

    // 提示词文本可见
    await page.waitForSelector('.case-detail-prompt');
    const promptText = (await page.textContent('.case-detail-prompt')) || '';
    expect(promptText.length).toBeGreaterThan(0);

    // 5) 套用提示词 → 描述框回填为该案例 prompt
    await page.click('.case-detail-actions button:has-text("套用此提示词")');
    await page.waitForTimeout(200);
    const filled = await page.inputValue('.gen-stage textarea.input');
    expect(filled).toBe(promptText);
  },
};
