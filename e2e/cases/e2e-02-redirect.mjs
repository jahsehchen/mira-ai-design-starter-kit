/**
 * E2E-02 未登录访问受保护路由重定向 + 登录后回跳
 * 断言：直接打开 /app/generator → 重定向 /login（RequireAuth 生效）；
 *      登录成功后回跳原目标 /app/generator。
 */
export default {
  id: 'E2E-02',
  name: '未登录访问受保护路由重定向 + 回跳',
  run: async ({ page, ctx }) => {
    // 1) 未登录直接访问受保护路由
    await page.goto(`${ctx.webUrl}/app/generator`, { waitUntil: 'domcontentloaded' });
    await page.waitForURL((url) => url.pathname === '/login', { timeout: 10000 });
    // 2) 登录成功后回跳原目标
    await ctx.loginViaUi(page, ctx.webUrl);
    await page.waitForURL((url) => url.pathname === '/app/generator', { timeout: 15000 });
    await page.waitForSelector('.gen-stage textarea.input');
  },
};
