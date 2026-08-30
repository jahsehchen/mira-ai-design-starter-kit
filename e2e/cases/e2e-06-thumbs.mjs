/**
 * E2E-06 案例缩略图无裂图（本地优先 + 三级回退）
 *
 * 断言：首屏网格每张可见 <img> 的 src 以 /images/thumbs/ 开头且 naturalWidth>0；
 *      无 .case-img-placeholder 占位（不裂图）。
 */
import { expect } from '../lib/assert.mjs';

export default {
  id: 'E2E-06',
  name: '案例缩略图无裂图',
  run: async ({ page, ctx }) => {
    const tokens = await ctx.loginViaApi();
    await ctx.setAuthStorage(page, tokens);
    await page.goto(`${ctx.webUrl}/app/generator`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.case-grid .case-card');

    const imgs = await page.$$('.case-grid img.case-card-img');
    expect(imgs.length).toBeGreaterThan(0);

    // 所有 src 以 /images/thumbs/ 开头（本地缩略图优先，R7 语义）
    for (const img of imgs) {
      const src = await img.getAttribute('src');
      expect(src).toMatch(/^\/images\/thumbs\//);
    }

    // 滚动逐个触发懒加载，断言 naturalWidth > 0
    // 用索引在页面内查 img（避免跨上下文传 elementHandle 引发的不稳定）
    const failedSrcs = [];
    const total = imgs.length;
    for (let i = 0; i < total; i += 1) {
      const src = await imgs[i].getAttribute('src');
      await imgs[i].scrollIntoViewIfNeeded();
      try {
        await page.waitForFunction(
          (idx) => {
            const el = document.querySelectorAll('.case-grid img.case-card-img')[idx];
            return Boolean(el && el.complete && el.naturalWidth > 0);
          },
          i,
          { timeout: 10000 },
        );
      } catch {
        failedSrcs.push(src);
      }
    }
    expect(failedSrcs.length).toBe(0);

    // 无占位（三级回退全部失败才会出现占位）
    const placeholders = await page.$$('.case-grid .case-img-placeholder');
    expect(placeholders.length).toBe(0);
  },
};
