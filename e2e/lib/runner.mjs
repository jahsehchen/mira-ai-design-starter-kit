/**
 * MIRA·弥画 e2e 轻量 runner（零依赖，playwright-core 直驱）
 *
 * test(id, name, fn) 注册用例；runAll 串行执行：
 *  - 每用例独立 browser context（隔离 localStorage/登录态）
 *  - 每用例 30s 超时（Promise.race，可配置）
 *  - 失败捕获 → ctx.shot 截图 → 记录 { id, name, status, error, ms }
 */
export function createRunner() {
  const cases = [];

  function test(id, name, fn) {
    if (!id || !name || typeof fn !== 'function') {
      throw new Error(`用例注册参数非法: id=${id} name=${name}`);
    }
    cases.push({ id, name, fn });
  }

  /** 超时包装：用例 promise 与定时器赛跑，先到先得；清除定时器防事件循环悬挂 */
  async function withTimeout(promise, ms, label) {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label}超时（${ms}ms）`)), ms);
    });
    try {
      return await Promise.race([promise, timeout]);
    } finally {
      clearTimeout(timer);
    }
  }

  async function runAll(ctx, { timeoutMs = 30000 } = {}) {
    const results = [];
    for (const c of cases) {
      const start = Date.now();
      let status = 'passed';
      let error = null;
      let page = null;
      let context = null;
      console.log(`  ▶ ${c.id} ${c.name} …`);
      try {
        context = await withTimeout(ctx.browser.newContext({ viewport: { width: 1440, height: 900 } }), timeoutMs, `[${c.id}] 创建 context`);
        page = await withTimeout(context.newPage(), timeoutMs, `[${c.id}] 创建 page`);
        await withTimeout(c.fn({ page, ctx }), timeoutMs, `[${c.id}] ${c.name}`);
      } catch (e) {
        status = 'failed';
        error = e;
        if (page) {
          try {
            await ctx.shot(page, `${c.id}-fail`);
          } catch (shotErr) {
            console.error(`    [截图失败] ${shotErr.message}`);
          }
        }
      } finally {
        if (context) {
          // close 加超时兜底：个别 Chrome 版本上 playwright close 可能悬挂
          await Promise.race([
            context.close().catch(() => undefined),
            new Promise((resolve) => setTimeout(resolve, 5000)),
          ]);
        }
      }
      results.push({ id: c.id, name: c.name, status, error, ms: Date.now() - start });
      if (status === 'passed') {
        console.log(`    ✔ ${c.id} ${c.name}（${Date.now() - start}ms）`);
      } else {
        console.error(`    ✘ ${c.id} ${c.name}（${Date.now() - start}ms）：${error?.message ?? String(error)}`);
      }
    }
    return results;
  }

  return { test, runAll };
}
