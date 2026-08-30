#!/usr/bin/env node
/**
 * MIRA·弥画 e2e 统一入口（R8）
 *
 * 流程：banner → 前置健康检查（web/api，未就绪 exit 2）→ ensureDemoAccount →
 *       launchBrowser → 串行执行 8 用例（每用例独立 context、30s 超时、失败截图）→ 汇总退出。
 * 退出码：0 全绿；1 用例失败；2 前置未就绪/环境异常（与用例失败区分）。
 *
 * 用法：NODE_OPTIONS="" npm run e2e
 */
import { createRunner } from './lib/runner.mjs';
import { launchBrowser } from './lib/browser.mjs';
import { createCtx, healthCheck, ensureDemoAccount, WEB_URL, API_URL } from './lib/helpers.mjs';

import case01 from './cases/e2e-01-landing.mjs';
import case02 from './cases/e2e-02-redirect.mjs';
import case03 from './cases/e2e-03-login.mjs';
import case04 from './cases/e2e-04-register.mjs';
import case05 from './cases/e2e-05-generator-detail.mjs';
import case06 from './cases/e2e-06-thumbs.mjs';
import case07 from './cases/e2e-07-gallery.mjs';
import case08 from './cases/e2e-08-editor-undo.mjs';
import case09 from './cases/e2e-09-subscribe.mjs';

async function main() {
  console.log('==================================================');
  console.log('[e2e] MIRA·弥画 浏览器端到端测试（playwright-core + 系统 Chrome）');
  console.log('==================================================');
  console.log(`  web: ${WEB_URL}`);
  console.log(`  api: ${API_URL}\n`);

  // 1) 前置健康检查
  console.log('[1/4] 前置健康检查…');
  let health;
  try {
    health = await healthCheck();
  } catch (e) {
    console.error(`  ✘ 健康检查请求失败：${e.message}`);
    health = { webOk: false, apiOk: false, webStatus: 0, apiStatus: 0 };
  }
  if (!health.webOk || !health.apiOk) {
    console.error('\n[e2e] 前置未就绪：web 或 api 未启动，无法运行 e2e。');
    console.error(`  web  ${WEB_URL}            -> ${health.webOk ? 'OK' : `失败（HTTP ${health.webStatus}）`}`);
    console.error(`  api  ${API_URL}/health -> ${health.apiOk ? 'OK' : `失败（HTTP ${health.apiStatus}）`}`);
    console.error('  请先启动：');
    console.error('    cd mira-app && NODE_OPTIONS="" npm run dev   （并行启动 web:5173 + api:3000）');
    console.error('  或分别启动：');
    console.error('    NODE_OPTIONS="" npm run dev:web');
    console.error('    NODE_OPTIONS="" npm run dev:api');
    console.error('  就绪后重新运行：NODE_OPTIONS="" npm run e2e');
    process.exit(2);
  }
  console.log(`  ✔ web ${WEB_URL} 可达`);
  console.log(`  ✔ api ${API_URL}/health 可达`);

  // 2) 演示账号幂等确保（种子数据或随库重置均可自洽）
  console.log('\n[2/4] 确保演示账号（demo@mira.app）…');
  let demoTokens;
  try {
    demoTokens = await ensureDemoAccount();
    console.log(`  ✔ 演示账号可用（${demoTokens.user?.email ?? 'demo@mira.app'}）`);
  } catch (e) {
    console.error(`  ✘ 演示账号确保失败：${e.message}`);
    console.error('  请检查 api 是否可正常注册/登录，然后重试。');
    process.exit(2);
  }

  // 3) 启动系统 Chrome（headless）
  console.log('\n[3/4] 启动系统 Chrome（headless）…');
  let browser;
  try {
    browser = await launchBrowser();
    console.log('  ✔ 浏览器已启动');
  } catch (e) {
    console.error(`  ✘ 浏览器启动失败：${e.message}`);
    console.error('  默认路径：C:/Program Files/Google/Chrome/Application/chrome.exe');
    console.error('  可通过环境变量覆盖：CHROME_PATH="C:/path/to/chrome.exe" NODE_OPTIONS="" npm run e2e');
    process.exit(2);
  }

  // 4) 注册并串行执行用例
  console.log('\n[4/4] 串行执行用例（每用例独立 context，30s 超时）…\n');
  const runner = createRunner();
  for (const c of [case01, case02, case03, case04, case05, case06, case07, case08, case09]) {
    runner.test(c.id, c.name, c.run);
  }
  const ctx = createCtx(browser);
  const results = await runner.runAll(ctx, { timeoutMs: 30000 });

  // 关闭浏览器（带超时兜底：个别 Chrome 版本 playwright close 可能悬挂；随后 process.exit 兜底退出）
  await Promise.race([
    browser.close().catch(() => undefined),
    new Promise((resolve) => setTimeout(resolve, 5000)),
  ]);

  // 汇总
  console.log('\n--------------------------------------------------');
  const passed = results.filter((r) => r.status === 'passed').length;
  const failed = results.length - passed;
  for (const r of results) {
    if (r.status === 'passed') {
      console.log(`  ✔ ${r.id} ${r.name}（${r.ms}ms）`);
    } else {
      console.error(`  ✘ ${r.id} ${r.name}（${r.ms}ms）`);
      console.error(`      ${r.error?.message ?? String(r.error)}`);
      console.error(`      截图已保存至 reports/e2e/${r.id}-fail-*.png`);
    }
  }
  console.log('--------------------------------------------------');
  console.log(`[e2e] 结果：${passed} 通过 / ${failed} 失败 / 共 ${results.length} 用例`);
  console.log('--------------------------------------------------');
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('\n[e2e] 执行异常：', e);
  process.exit(1);
});
