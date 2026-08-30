/**
 * MIRA·弥画 e2e 通用辅助（零依赖，Node ≥20 内置 fetch）
 *
 * 提供给用例的 ctx：
 *  - webUrl / apiUrl            默认 http://localhost:5173 / http://localhost:3000/api/v1（环境变量可覆盖）
 *  - loginViaApi()              API 登录 demo → { accessToken, refreshToken, user }
 *  - setAuthStorage(page, t)    addInitScript 注入 localStorage（mira_access_token / mira_refresh_token）
 *  - loginViaUi(page)           UI 走 /login 填 demo 提交（E2E-02/03 用）
 *  - ensureEditableWork(token)  GET /works 取第一个；空则 POST /works 创建最小 canvasJson 作品 → workId
 *  - assertImgLoaded(page, sel) waitForFunction naturalWidth > 0
 *  - shot(page, name)           截图到 reports/e2e/{name}-{ts}.png
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const E2E_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const REPORTS_DIR = path.join(E2E_ROOT, 'reports/e2e');
export const WEB_URL = process.env.E2E_WEB_URL || 'http://localhost:5173';
export const API_URL = (process.env.E2E_API_URL || 'http://localhost:3000/api/v1').replace(/\/$/, '');

export const DEMO_EMAIL = 'demo@mira.app';
export const DEMO_PASSWORD = 'Passw0rd!';

const ACCESS_KEY = 'mira_access_token';
const REFRESH_KEY = 'mira_refresh_token';

/** 通用 API 请求（e2e 侧直连后端，走 3000，不经 vite proxy） */
async function apiRequest(apiUrl, apiPath, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${apiUrl}${apiPath}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  const text = await res.text();
  try {
    json = JSON.parse(text);
  } catch {
    /* 非 JSON 响应 */
  }
  return { status: res.status, json, text };
}

/**
 * 前置健康检查：web `/` 返回 HTML；api `/api/v1/health` 返回 { code:0, data:{status:'ok'} }。
 * @returns {{ webOk: boolean, apiOk: boolean, webStatus: number, apiStatus: number }}
 */
export async function healthCheck(webUrl = WEB_URL, apiUrl = API_URL) {
  let webStatus = 0;
  let webOk = false;
  try {
    const webRes = await fetch(webUrl, { method: 'GET' });
    webStatus = webRes.status;
    const webHtml = await webRes.text();
    webOk = webRes.status === 200 && /<html/i.test(webHtml);
  } catch {
    webOk = false;
  }
  let apiStatus = 0;
  let apiOk = false;
  try {
    const apiRes = await apiRequest(apiUrl, '/health');
    apiStatus = apiRes.status;
    apiOk = apiRes.status === 200 && apiRes.json?.code === 0 && apiRes.json?.data?.status === 'ok';
  } catch {
    apiOk = false;
  }
  return { webOk, apiOk, webStatus, apiStatus };
}

/** API 登录 demo 账号 → { accessToken, refreshToken, user }；失败抛错 */
export async function loginViaApi(apiUrl = API_URL, email = DEMO_EMAIL, password = DEMO_PASSWORD) {
  const { status, json } = await apiRequest(apiUrl, '/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  if (status !== 200 || !json || json.code !== 0 || !json.data?.accessToken) {
    throw new Error(`登录失败 status=${status} body=${JSON.stringify(json)}`);
  }
  return json.data;
}

/**
 * 幂等确保演示账号：先 API login（种子数据/已注册直接命中）；
 * 401/账号不存在 → API register 兜底；409（重复注册）→ 再试 login。
 * 全部失败抛错（由 run.mjs 转 exit 2）。
 */
export async function ensureDemoAccount(apiUrl = API_URL, email = DEMO_EMAIL, password = DEMO_PASSWORD) {
  const { status, json } = await apiRequest(apiUrl, '/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  if (status === 200 && json?.code === 0 && json.data?.accessToken) {
    return json.data;
  }
  const reg = await apiRequest(apiUrl, '/auth/register', {
    method: 'POST',
    body: { email, password, nickname: '演示账号' },
  });
  if (reg.status === 201 && reg.json?.code === 0 && reg.json.data?.accessToken) {
    return reg.json.data;
  }
  if (reg.status === 409 || reg.status === 400) {
    const retry = await apiRequest(apiUrl, '/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    if (retry.status === 200 && retry.json?.code === 0 && retry.json.data?.accessToken) {
      return retry.json.data;
    }
  }
  throw new Error(`演示账号确保失败 login=${status} register=${reg.status} body=${JSON.stringify(reg.json)}`);
}

/**
 * 注入登录态：addInitScript 在每次导航前写入 localStorage。
 * authStore.init() 会读取这两把钥匙并调用 /auth/me 恢复 user，RequireAuth 放行。
 */
export async function setAuthStorage(page, tokens) {
  await page.addInitScript(
    ({ access, refresh }) => {
      localStorage.setItem('mira_access_token', access);
      localStorage.setItem('mira_refresh_token', refresh);
    },
    { access: tokens.accessToken, refresh: tokens.refreshToken },
  );
}

/** UI 登录（E2E-02/03 用）：goto /login → 填 demo → 提交 → 等待进入 /app/* */
export async function loginViaUi(page, webUrl = WEB_URL, email = DEMO_EMAIL, password = DEMO_PASSWORD) {
  await page.goto(`${webUrl}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.auth-form input[type="email"]');
  await page.fill('.auth-form input[type="email"]', email);
  await page.fill('.auth-form input[type="password"]', password);
  await page.click('.auth-form button[type="submit"]');
  await page.waitForURL((url) => url.pathname.startsWith('/app/'), { timeout: 15000 });
}

/**
 * 确保 demo 账号存在可编辑作品：
 * GET /works 取第一个；空则 POST /works 创建最小 canvasJson 作品（EditorPage 解析对齐）。
 * @returns {Promise<string>} workId
 */
export async function ensureEditableWork(apiUrl, token) {
  const { status, json } = await apiRequest(apiUrl, '/works?page=1&pageSize=1', { token });
  if (status !== 200 || !json || json.code !== 0) {
    throw new Error(`查询作品失败 status=${status} body=${JSON.stringify(json)}`);
  }
  if (Array.isArray(json.data.items) && json.data.items.length > 0) {
    return json.data.items[0].id;
  }
  const canvasJson = {
    version: 1,
    width: 1080,
    height: 1350,
    background: { type: 'gradient', from: '#2B4CFF', to: '#6A8BFF', overlayOpacity: 45 },
    elements: [
      { type: 'text', id: 'title', text: 'e2e 测试标题', x: 72, y: 800, fontSize: 64, fontWeight: 600, color: '#FFFFFF', fontFamily: 'display', letterSpacing: 2 },
      { type: 'text', id: 'subtitle', text: 'e2e 测试副标题', x: 72, y: 900, fontSize: 28, fontWeight: 400, color: '#FFFFFF', fontFamily: 'sans' },
      { type: 'text', id: 'price', text: '¥9.9', x: 72, y: 1000, fontSize: 56, fontWeight: 700, color: '#FFFFFF', fontFamily: 'display' },
    ],
    palette: ['#2B4CFF', '#6A8BFF', '#FFFFFF', '#23272B'],
  };
  const created = await apiRequest(apiUrl, '/works', {
    method: 'POST',
    token,
    body: { title: 'e2e 测试作品', description: 'e2e 前置创建', canvasJson, width: 1080, height: 1350 },
  });
  if (created.status !== 201 || !created.json || created.json.code !== 0 || !created.json.data?.id) {
    throw new Error(`创建作品失败 status=${created.status} body=${JSON.stringify(created.json)}`);
  }
  return created.json.data.id;
}

/**
 * 图片加载成功断言：selector 命中 <img> 且 complete + naturalWidth > 0。
 * 统一用 naturalWidth（不用 networkidle，CDN 高清外网慢会假失败）。
 */
export async function assertImgLoaded(page, selector, timeoutMs = 15000) {
  await page.waitForSelector(selector, { timeout: timeoutMs });
  await page.waitForFunction(
    (sel) => {
      const el = document.querySelector(sel);
      return Boolean(el && el.tagName === 'IMG' && el.complete && el.naturalWidth > 0);
    },
    selector,
    { timeout: timeoutMs },
  );
}

/** 截图到 reports/e2e/{name}-{ts}.png（自动建目录） */
export async function shot(page, name) {
  await mkdir(REPORTS_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const file = path.join(REPORTS_DIR, `${name}-${ts}.png`);
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

/** 组装用例 ctx（run.mjs 传入 browser） */
export function createCtx(browser) {
  return {
    webUrl: WEB_URL,
    apiUrl: API_URL,
    browser,
    loginViaApi,
    setAuthStorage,
    loginViaUi,
    ensureEditableWork,
    assertImgLoaded,
    shot,
  };
}
