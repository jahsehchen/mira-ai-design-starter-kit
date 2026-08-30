#!/usr/bin/env node
/**
 * QA · R5 跨页全选后端专项（补足 smoke 未覆盖的边界）
 *  - limit 钳制在 >20 作品时精确生效（ids.length === 20, total === 实际数）
 *  - sort=oldest 时 matching-ids 前 20 与 /works?sort=oldest 前 20 一致
 *  - 路由冲突回归：/works/matching-ids 不被 /works/:id 吞掉（返回 200 JSON 而非 404）
 *
 * 用法：NODE_OPTIONS="" node scripts/qa-r5-matching-ids-check.mjs [baseUrl]
 */
const BASE_URL = (process.env.SMOKE_BASE_URL || process.argv[2] || 'http://localhost:3000').replace(/\/$/, '');
const API = `${BASE_URL}/api/v1`;

let passed = 0;
let failed = 0;
function ok(name, detail = '') {
  passed += 1;
  console.log(`  ✔ ${name}${detail ? ` — ${detail}` : ''}`);
}
function fail(name, detail) {
  failed += 1;
  console.error(`  ✘ ${name} — ${detail}`);
}
async function request(pathname, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${pathname}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* 非 JSON */ }
  return { status: res.status, json, text };
}

console.log(`\nQA · R5 matching-ids 后端专项 @ ${BASE_URL}\n`);

// 1) 注册新账号
let token = '';
try {
  const email = `qa_r5_${Date.now()}@mira.test`;
  const { status, json } = await request('/auth/register', {
    method: 'POST',
    body: { email, password: 'QaR5Test123', nickname: 'R5专项' },
  });
  if (status !== 201 || json?.code !== 0 || !json?.data?.accessToken) throw new Error(`status=${status} body=${JSON.stringify(json)}`);
  token = json.data.accessToken;
  ok('准备：注册新账号', email);
} catch (e) {
  fail('准备：注册新账号', e.message);
  process.exit(1);
}

// 2) 创建 25 个作品（覆盖 >20 钳制）
try {
  for (let i = 1; i <= 25; i += 1) {
    const { status, json } = await request('/works', {
      method: 'POST',
      token,
      body: { title: `R5钳制测试-作品${String(i).padStart(2, '0')}`, description: 'R5 专项', canvasJson: { version: 1 } },
    });
    if (status !== 201 || json?.code !== 0) throw new Error(`第 ${i} 个创建失败 status=${status}`);
  }
  ok('准备：创建 25 个作品');
} catch (e) {
  fail('准备：创建 25 个作品', e.message);
  process.exit(1);
}

// 3) limit=100 → ids.length === 20（钳制精确生效），total === 25
try {
  const { status, json } = await request('/works/matching-ids?limit=100&sort=recent', { token });
  if (status !== 200 || json?.code !== 0) throw new Error(`status=${status} body=${JSON.stringify(json)}`);
  const { ids, total } = json.data;
  if (total !== 25) throw new Error(`total=${total} 期望 25`);
  if (!Array.isArray(ids) || ids.length !== 20) throw new Error(`ids.length=${ids?.length} 期望 20（钳制）`);
  ok('limit=100 → ids 精确钳制到 20', `total=${total} ids=${ids.length}`);
} catch (e) {
  fail('limit=100 → ids 精确钳制到 20', e.message);
}

// 4) sort=oldest 一致性：matching-ids 前 20 与 /works?sort=oldest 前 20 id 完全一致
try {
  const m = await request('/works/matching-ids?limit=100&sort=oldest', { token });
  const l = await request('/works?sort=oldest&page=1&pageSize=20', { token });
  const mIds = m.json?.data?.ids ?? [];
  const lIds = (l.json?.data?.items ?? []).map((w) => w.id);
  if (mIds.length !== lIds.length) throw new Error(`matching=${mIds.length} list=${lIds.length}`);
  const same = mIds.every((id, i) => id === lIds[i]);
  if (!same) throw new Error('顺序不一致');
  ok('sort=oldest：matching-ids 与列表前 20 顺序一致', `共 ${mIds.length} 条`);
} catch (e) {
  fail('sort=oldest：matching-ids 与列表前 20 顺序一致', e.message);
}

// 5) keyword 过滤 total 一致
try {
  const kw = 'R5钳制测试';
  const m = await request(`/works/matching-ids?keyword=${encodeURIComponent(kw)}&limit=100`, { token });
  const l = await request(`/works?keyword=${encodeURIComponent(kw)}&page=1&pageSize=1`, { token });
  if (m.json?.data?.total !== l.json?.data?.total) {
    throw new Error(`matching total=${m.json?.data?.total} list total=${l.json?.data?.total}`);
  }
  ok('keyword 过滤 total 与列表一致', `total=${m.json?.data?.total}`);
} catch (e) {
  fail('keyword 过滤 total 与列表一致', e.message);
}

// 6) 路由冲突回归：/works/matching-ids 200 JSON（未被 /works/:id 吞掉）
try {
  const { status, json } = await request('/works/matching-ids?sort=recent', { token });
  if (status !== 200 || json?.code !== 0 || !Array.isArray(json?.data?.ids)) {
    throw new Error(`status=${status} body=${JSON.stringify(json).slice(0, 200)}`);
  }
  ok('路由冲突回归：/works/matching-ids 返回 200 JSON', `ids=${json.data.ids.length}`);
} catch (e) {
  fail('路由冲突回归：/works/matching-ids 返回 200 JSON', e.message);
}

// 7) 无 token → 401（鉴权守卫）
try {
  const { status } = await request('/works/matching-ids');
  if (status !== 401) throw new Error(`期望 401，实际 ${status}`);
  ok('matching-ids 未登录 → 401');
} catch (e) {
  fail('matching-ids 未登录 → 401', e.message);
}

console.log(`\nR5 后端专项结果：${passed} 通过 / ${failed} 失败\n`);
process.exit(failed > 0 ? 1 : 0);
