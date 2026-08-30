/**
 * E2E-08 编辑器撤销/重做可用态
 *
 * 前置：ensureEditableWork 创建含 title 元素的最小 canvasJson 作品。
 * 断言：初始撤销/重做 disabled（历史基线）；
 *      修改标题文字 → 撤销可用（disabled=false）；
 *      执行撤销 → 内容回退、重做可用；执行重做 → 内容前进。
 */
import { expect } from '../lib/assert.mjs';

export default {
  id: 'E2E-08',
  name: '编辑器撤销/重做可用态',
  run: async ({ page, ctx }) => {
    const tokens = await ctx.loginViaApi();
    await ctx.setAuthStorage(page, tokens);
    const workId = await ctx.ensureEditableWork(ctx.apiUrl, tokens.accessToken);

    await page.goto(`${ctx.webUrl}/app/editor/${workId}`, { waitUntil: 'domcontentloaded' });
    // 等待作品加载完成（标题输入出现 = 编辑器 UI 就绪）
    await page.waitForSelector('.panel-section input');

    const undoBtn = page.locator('.editor-toolbar button', { hasText: '撤销' }).first();
    const redoBtn = page.locator('.editor-toolbar button', { hasText: '重做' }).first();
    await undoBtn.waitFor({ state: 'visible', timeout: 10000 });

    // 初始：撤销/重做均 disabled（作品加载后 resetHistory，初始态即基线）
    expect(await undoBtn.isDisabled()).toBe(true);
    expect(await redoBtn.isDisabled()).toBe(true);

    // 修改标题文字 → 撤销可用
    const titleInput = page.locator('.panel-section input').first();
    const original = await titleInput.inputValue();
    const changed = `${original}·改`;
    await titleInput.fill(changed);
    await page.waitForFunction(
      () => {
        const btns = Array.from(document.querySelectorAll('.editor-toolbar button'));
        const undo = btns.find((b) => b.textContent && b.textContent.includes('撤销'));
        return Boolean(undo && !undo.disabled);
      },
      undefined,
      { timeout: 5000 },
    );
    expect(await undoBtn.isDisabled()).toBe(false);

    // 执行撤销 → 标题回退、重做可用
    await undoBtn.click();
    await page.waitForFunction(
      (expected) => {
        const input = document.querySelector('.panel-section input');
        return Boolean(input && input.value === expected);
      },
      original,
      { timeout: 5000 },
    );
    expect(await redoBtn.isDisabled()).toBe(false);

    // 执行重做 → 标题前进
    await redoBtn.click();
    await page.waitForFunction(
      (expected) => {
        const input = document.querySelector('.panel-section input');
        return Boolean(input && input.value === expected);
      },
      changed,
      { timeout: 5000 },
    );
  },
};
