/**
 * E2E-01 落地页加载
 * 断言：页面标题/H1 含 MIRA·弥画；主 CTA 可见；定价页卡片可见。
 */
import { expect } from '../lib/assert.mjs';

export default {
  id: 'E2E-01',
  name: '落地页加载',
  run: async ({ page, ctx }) => {
    // 首页首屏
    await page.goto(`${ctx.webUrl}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.hero-title');
    const title = await page.title();
    expect(title).toMatch(/MIRA|弥画/);
    const h1 = (await page.textContent('.hero-title')) || '';
    expect(h1).toContain('好设计');
    // 主 CTA（开始创作类按钮）可见
    await page.waitForSelector('.hero-cta button');
    const ctaText = (await page.textContent('.hero-cta')) || '';
    expect(ctaText.length).toBeGreaterThan(0);
    // 定价卡片可见（/pricing 的 pricing-grid 渲染方案卡）
    await page.goto(`${ctx.webUrl}/pricing`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.pricing-grid');
    await page.waitForSelector('.pricing-grid .price-card', { timeout: 10000 });
    const cards = await page.$$('.pricing-grid .price-card');
    expect(cards.length).toBeGreaterThan(0);
  },
};
