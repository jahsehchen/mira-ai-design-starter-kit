/**
 * E2E-09 订阅闭环：订阅页 → Pro 月付 → 订单确认 → mock 支付 → 套餐生效
 *
 * 前置：幂等恢复 demo plan=free（防上次失败残留 pro）
 * 流程：注入登录态 → /app/subscribe → 断言三卡渲染 + Free 卡当前方案
 *       → 点 Pro「立即升级」→ 订单确认卡（¥39/月付/订单号）→ 确认支付
 *       → 断言套餐生效：状态卡额度 500/500、侧栏 plan=Pro、侧栏/顶栏额度 chip 500/500、me API plan=pro
 *       → 生成页可达（额度已提升，正常额度下不触发 QUOTA_EXCEEDED 引导）
 * 清理：finally 中调 cancel API + 直接改库恢复 demo plan=free（不影响其他用例对 demo 的假设）
 */
import { expect } from '../lib/assert.mjs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const sqlite3 = require('sqlite3');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, '../../mira.sqlite');

/** 直接改库恢复 demo plan=free（后端无降级 API；仅本用例清理用，带 busy_timeout 防锁） */
function restoreDemoPlanFree() {
  return new Promise((resolve) => {
    const db = new sqlite3.Database(DB_PATH);
    db.serialize(() => {
      db.run('PRAGMA busy_timeout = 5000');
      db.run(`UPDATE users SET plan='free' WHERE email='demo@mira.app'`, (err) => {
        db.close(() => resolve(!err));
      });
    });
  });
}

/** e2e 侧直连后端 API（带 token） */
async function apiCall(apiUrl, apiPath, { method = 'GET', token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${apiUrl}${apiPath}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

export default {
  id: 'E2E-09',
  name: '订阅闭环：订阅页 → Pro 月付 → mock 支付 → 套餐生效',
  run: async ({ page, ctx }) => {
    let tokens = null;
    try {
      tokens = await ctx.loginViaApi();
      await ctx.setAuthStorage(page, tokens);
      const token = tokens.accessToken;

      // 幂等前置：确保 demo 为 free（防上次失败残留 pro 导致按钮文案漂移）
      await restoreDemoPlanFree();
      await apiCall(ctx.apiUrl, '/subscriptions/cancel', { method: 'POST', token }).catch(() => undefined);

      // 1) 订阅页渲染：三张套餐卡 + Free 卡「当前方案」
      await page.goto(`${ctx.webUrl}/app/subscribe`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.subscribe-page');
      await page.waitForSelector('.sub-price-card');
      const cards = await page.$$('.sub-price-card');
      expect(cards.length).toBe(3);
      const freeCardText = (await page.locator('.sub-price-card', { hasText: '免费版' }).first().textContent()) || '';
      expect(freeCardText).toContain('当前方案');

      // 2) 选 Pro 月付 → 立即升级 → 订单确认卡
      await page.click('.sub-price-card.featured button:has-text("立即升级")');
      await page.waitForSelector('.sub-order-confirm', { timeout: 10000 });
      const confirmText = (await page.textContent('.sub-order-confirm')) || '';
      expect(confirmText).toContain('Pro');
      expect(confirmText).toContain('月付');
      expect(confirmText).toContain('¥39');
      const orderNo = (await page.textContent('.sub-order-confirm .sub-order-no')) || '';
      expect(orderNo.length).toBeGreaterThan(0);

      // 3) 确认支付 → 成功 toast
      await page.click('.sub-order-pay');
      await page.waitForSelector('.toast.success', { timeout: 10000 });

      // 4) 套餐生效断言：状态卡额度 500/月、侧栏 plan=Pro、侧栏/顶栏额度 chip /500
      await page.waitForFunction(
        () => {
          const el = document.querySelector('.sub-quota-line');
          return Boolean(el && el.textContent && el.textContent.includes('500 次/月'));
        },
        undefined,
        { timeout: 10000 },
      );
      const planText = (await page.textContent('.side-foot-text .plan')) || '';
      expect(planText).toContain('Pro');
      const sideQuota = (await page.textContent('.side-user .quota-line')) || '';
      expect(sideQuota).toContain('/500 次/月');
      const topQuota = (await page.textContent('.quota-chip')) || '';
      expect(topQuota).toContain('/500');

      // 5) API 层断言：me plan=pro + 配额 500（remaining 为本月已用抵扣，>0 即可）
      const me = await apiCall(ctx.apiUrl, '/subscriptions/me', { token });
      expect(me.json?.data?.plan).toBe('pro');
      expect(me.json?.data?.quotaPerMonth).toBe(500);
      expect(me.json?.data?.remainingGenerations).toBeGreaterThan(0);

      // 6) 生成页可达（额度已提升，正常额度下不会触发 QUOTA_EXCEEDED 升级引导）
      await page.goto(`${ctx.webUrl}/app/generator`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.gen-stage textarea.input');
    } finally {
      // 清理：cancel API + 改库恢复 demo plan=free（幂等，不影响其他用例）
      if (tokens?.accessToken) {
        await apiCall(ctx.apiUrl, '/subscriptions/cancel', { method: 'POST', token: tokens.accessToken }).catch(() => undefined);
      }
      await restoreDemoPlanFree().catch(() => undefined);
    }
  },
};
