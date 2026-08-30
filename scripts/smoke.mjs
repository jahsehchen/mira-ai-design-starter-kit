#!/usr/bin/env node
/**
 * MIRA·弥画 端到端冒烟脚本（A1 + 核心闭环）
 *
 * 流程：
 *  1. GET  /api/v1/health          —— 健康检查（status/version/db）
 *  2. POST /api/v1/auth/register   —— 注册（随机邮箱）
 *  3. POST /api/v1/auth/login      —— 登录（拿双令牌）
 *  4. GET  /api/v1/auth/me         —— 鉴权回读（401 守卫验证）
 *  5. POST /api/v1/ai/generations  —— 创建生成任务
 *  6. GET  /api/v1/ai/generations/:id —— 轮询到 succeeded（三态）
 *  7. GET  /api/v1/works           —— 生成结果落库为作品
 *  8. POST /api/v1/export/jobs     —— 创建导出任务
 *  9. GET  /api/v1/export/jobs/:id —— 轮询到 succeeded
 * 10. GET  /api/v1/export/files/:jobId/:fileId —— 下载文件（200 + 非空）
 *
 * 用法：node scripts/smoke.mjs [baseUrl]
 * 环境：SMOKE_BASE_URL 覆盖默认 http://localhost:3000
 */
const BASE_URL = (process.env.SMOKE_BASE_URL || process.argv[2] || 'http://localhost:3000').replace(/\/$/, '');
const API = `${BASE_URL}/api/v1`;

let passed = 0;
let failed = 0;

function ok(name, detail = '') {
  passed += 1;
  console.log(`  ✔ ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, err) {
  failed += 1;
  console.error(`  ✘ ${name} — ${err && err.message ? err.message : String(err)}`);
}

async function request(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  const text = await res.text();
  try {
    json = JSON.parse(text);
  } catch {
    /* 非 JSON 响应（如下载流） */
  }
  return { status: res.status, json, text };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function pollGeneration(token, id, maxTries = 120) {
  // QA 修正：NVIDIA 上游 429 限流时 LLM 重试 + 生图总耗时可达 60-70s，
  // 60s 轮询窗口偶发超时（生成最终 succeeded，非逻辑问题）；与 smoke-p1 对齐放宽到 120s。
  for (let i = 0; i < maxTries; i += 1) {
    const { status, json } = await request(`/ai/generations/${id}`, { token });
    if (status !== 200 || !json || json.code !== 0) {
      throw new Error(`轮询生成任务失败 status=${status} body=${JSON.stringify(json)}`);
    }
    const g = json.data;
    if (g.status === 'succeeded' || g.status === 'failed') return g;
    await sleep(1000);
  }
  throw new Error('生成任务轮询超时（120s）');
}

async function pollExport(token, id, maxTries = 60) {
  for (let i = 0; i < maxTries; i += 1) {
    const { status, json } = await request(`/export/jobs/${id}`, { token });
    if (status !== 200 || !json || json.code !== 0) {
      throw new Error(`轮询导出任务失败 status=${status} body=${JSON.stringify(json)}`);
    }
    const j = json.data;
    if (j.status === 'succeeded' || j.status === 'failed') return j;
    await sleep(1000);
  }
  throw new Error('导出任务轮询超时（60s）');
}

async function main() {
  console.log(`\nMIRA·弥画 冒烟测试 @ ${BASE_URL}\n`);

  // 1. 健康检查
  try {
    const { status, json } = await request('/health');
    if (status === 200 && json && json.code === 0 && json.data.status === 'ok' && json.data.db === 'up') {
      ok('GET /health', `version=${json.data.version} db=${json.data.db}`);
    } else {
      throw new Error(`status=${status} body=${JSON.stringify(json)}`);
    }
  } catch (e) {
    fail('GET /health', e);
  }

  // 2. 注册
  const email = `smoke_${Date.now()}@mira.test`;
  const password = 'SmokeTest123';
  let accessToken = '';
  let refreshToken = '';
  try {
    const { status, json } = await request('/auth/register', {
      method: 'POST',
      body: { email, password, nickname: '冒烟测试' },
    });
    if (status === 201 && json && json.code === 0 && json.data.accessToken) {
      accessToken = json.data.accessToken;
      refreshToken = json.data.refreshToken;
      ok('POST /auth/register', email);
    } else {
      throw new Error(`status=${status} body=${JSON.stringify(json)}`);
    }
  } catch (e) {
    fail('POST /auth/register', e);
    return;
  }

  // 3. 登录
  try {
    const { status, json } = await request('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    if (status === 200 && json && json.code === 0 && json.data.accessToken) {
      accessToken = json.data.accessToken;
      refreshToken = json.data.refreshToken;
      ok('POST /auth/login');
    } else {
      throw new Error(`status=${status} body=${JSON.stringify(json)}`);
    }
  } catch (e) {
    fail('POST /auth/login', e);
  }

  // 4. 鉴权回读
  try {
    const { status, json } = await request('/auth/me', { token: accessToken });
    if (status === 200 && json && json.code === 0 && json.data.email === email) {
      ok('GET /auth/me（JWT 守卫）', `nickname=${json.data.nickname}`);
    } else {
      throw new Error(`status=${status} body=${JSON.stringify(json)}`);
    }
  } catch (e) {
    fail('GET /auth/me（JWT 守卫）', e);
  }

  // 4.1 未登录 401
  try {
    const { status } = await request('/auth/me');
    if (status === 401) {
      ok('未登录访问受保护接口返回 401');
    } else {
      throw new Error(`期望 401，实际 ${status}`);
    }
  } catch (e) {
    fail('未登录访问受保护接口返回 401', e);
  }

  // 5. 创建生成任务
  let generationId = '';
  try {
    const { status, json } = await request('/ai/generations', {
      method: 'POST',
      token: accessToken,
      body: { prompt: '科技感海报，蓝色主调，标题「AI 发布会」', stylePreset: '科技感', options: { count: 2, autoMatch: true } },
    });
    if (status === 201 && json && json.code === 0 && json.data.generationId) {
      generationId = json.data.generationId;
      ok('POST /ai/generations', `id=${generationId}`);
    } else {
      throw new Error(`status=${status} body=${JSON.stringify(json)}`);
    }
  } catch (e) {
    fail('POST /ai/generations', e);
  }

  // 6. 轮询三态
  let workCountBefore = 0;
  try {
    const g = await pollGeneration(accessToken, generationId);
    if (g.status === 'succeeded' && g.result && g.steps.every((s) => s.state === 'done')) {
      ok('GET /ai/generations/:id（三态轮询）', `status=succeeded step=${g.step} title=${g.result.title}`);
    } else {
      throw new Error(`生成未成功 status=${g.status} error=${JSON.stringify(g.error)}`);
    }
  } catch (e) {
    fail('GET /ai/generations/:id（三态轮询）', e);
  }

  // 7. 作品落库
  let workId = '';
  try {
    const { status, json } = await request('/works?page=1&pageSize=5', { token: accessToken });
    if (status === 200 && json && json.code === 0 && Array.isArray(json.data.items) && json.data.items.length > 0) {
      workId = json.data.items[0].id;
      workCountBefore = json.data.total;
      ok('GET /works（生成结果落库）', `total=${json.data.total} first=${json.data.items[0].title}`);
    } else {
      throw new Error(`status=${status} body=${JSON.stringify(json)}`);
    }
  } catch (e) {
    fail('GET /works（生成结果落库）', e);
  }

  // 7.1 R5 跨页全选：matching-ids 接口（total 一致 / 上限钳制 / keyword 过滤 / owner 隔离）
  const extraTitles = ['P2匹配测试-柠檬茶', 'P2匹配测试-冰美式', 'P2匹配测试-桃桃乌龙'];
  let matchingTotalBefore = 0;
  try {
    const { json: listJson } = await request('/works?page=1&pageSize=1', { token: accessToken });
    matchingTotalBefore = listJson?.data?.total ?? 0;
    for (const title of extraTitles) {
      const { status, json } = await request('/works', {
        method: 'POST',
        token: accessToken,
        body: { title, description: 'R5 冒烟测试作品', canvasJson: { version: 1 } },
      });
      if (status !== 201 || !json || json.code !== 0) {
        throw new Error(`创建 ${title} 失败 status=${status} body=${JSON.stringify(json)}`);
      }
    }
    ok('POST /works × 3（R5 造数）', extraTitles.join('、'));
  } catch (e) {
    fail('POST /works × 3（R5 造数）', e);
  }

  try {
    const { status, json } = await request('/works/matching-ids', { token: accessToken });
    const expectedTotal = matchingTotalBefore + extraTitles.length;
    if (
      status === 200 &&
      json &&
      json.code === 0 &&
      Array.isArray(json.data.ids) &&
      typeof json.data.total === 'number' &&
      json.data.total === expectedTotal &&
      json.data.ids.length === json.data.total
    ) {
      ok('GET /works/matching-ids（total 与列表一致）', `total=${json.data.total} ids=${json.data.ids.length}`);
    } else {
      throw new Error(`status=${status} body=${JSON.stringify(json)} 期望 total=${expectedTotal}`);
    }
  } catch (e) {
    fail('GET /works/matching-ids（total 与列表一致）', e);
  }

  try {
    const { status, json } = await request('/works/matching-ids?limit=100', { token: accessToken });
    if (status === 200 && json && json.code === 0 && Array.isArray(json.data.ids) && json.data.ids.length <= 20) {
      ok('GET /works/matching-ids?limit=100（上限钳制 ≤20）', `ids=${json.data.ids.length}`);
    } else {
      throw new Error(`status=${status} body=${JSON.stringify(json)}`);
    }
  } catch (e) {
    fail('GET /works/matching-ids?limit=100（上限钳制 ≤20）', e);
  }

  try {
    const kw = 'P2匹配测试';
    const { status, json } = await request(`/works/matching-ids?keyword=${encodeURIComponent(kw)}`, {
      token: accessToken,
    });
    const { json: listKw } = await request(`/works?keyword=${encodeURIComponent(kw)}&page=1&pageSize=1`, {
      token: accessToken,
    });
    if (
      status === 200 &&
      json &&
      json.code === 0 &&
      listKw &&
      listKw.code === 0 &&
      json.data.total === listKw.data.total &&
      json.data.ids.length === Math.min(json.data.total, 20)
    ) {
      ok('GET /works/matching-ids?keyword（过滤与列表一致）', `total=${json.data.total}`);
    } else {
      throw new Error(`status=${status} body=${JSON.stringify(json)} list=${JSON.stringify(listKw)}`);
    }
  } catch (e) {
    fail('GET /works/matching-ids?keyword（过滤与列表一致）', e);
  }

  try {
    const email2 = `smoke2_${Date.now()}@mira.test`;
    const { json: reg2 } = await request('/auth/register', {
      method: 'POST',
      body: { email: email2, password: 'SmokeTest123', nickname: '冒烟测试2' },
    });
    const token2 = reg2?.data?.accessToken;
    if (!token2) throw new Error('注册第二用户失败');
    const { status, json } = await request('/works/matching-ids', { token: token2 });
    if (status === 200 && json && json.code === 0 && json.data.total === 0 && json.data.ids.length === 0) {
      ok('GET /works/matching-ids（owner 隔离）', '第二用户 total=0');
    } else {
      throw new Error(`status=${status} body=${JSON.stringify(json)}`);
    }
  } catch (e) {
    fail('GET /works/matching-ids（owner 隔离）', e);
  }

  // 8. 创建导出任务
  let jobId = '';
  try {
    const { status, json } = await request('/export/jobs', {
      method: 'POST',
      token: accessToken,
      body: {
        workId,
        format: 'png',
        sizes: [
          { key: '1:1', width: 1080, height: 1080, label: '社媒帖子' },
          { key: '9:16', width: 1080, height: 1920, label: '短视频 / 竖版' },
        ],
      },
    });
    if (status === 201 && json && json.code === 0 && json.data.jobId) {
      jobId = json.data.jobId;
      ok('POST /export/jobs', `id=${jobId}`);
    } else {
      throw new Error(`status=${status} body=${JSON.stringify(json)}`);
    }
  } catch (e) {
    fail('POST /export/jobs', e);
  }

  // 9. 轮询导出
  let fileId = '';
  try {
    const j = await pollExport(accessToken, jobId);
    if (j.status === 'succeeded' && j.files && j.files.length > 0) {
      fileId = j.files[0].fileId;
      ok('GET /export/jobs/:id（队列进度）', `progress=100 files=${j.files.length} first=${j.files[0].fileName}`);
    } else {
      throw new Error(`导出未成功 status=${j.status} error=${JSON.stringify(j.error)}`);
    }
  } catch (e) {
    fail('GET /export/jobs/:id（队列进度）', e);
  }

  // 10. 下载文件
  try {
    const headers = { Authorization: `Bearer ${accessToken}` };
    const res = await fetch(`${API}/export/files/${jobId}/${fileId}`, { headers });
    const buf = Buffer.from(await res.arrayBuffer());
    if (res.status === 200 && buf.length > 0 && res.headers.get('content-type') !== 'application/json') {
      ok('GET /export/files/:jobId/:fileId（下载）', `${buf.length} bytes`);
    } else {
      throw new Error(`status=${res.status} size=${buf.length}`);
    }
  } catch (e) {
    fail('GET /export/files/:jobId/:fileId（下载）', e);
  }

  // 11. 分享链接（P1）
  try {
    const { status, json } = await request('/shares', {
      method: 'POST',
      token: accessToken,
      body: { workId },
    });
    if (status === 201 && json && json.code === 0 && json.data.token) {
      const { status: pubStatus, json: pubJson } = await request(`/shares/${json.data.token}`);
      if (pubStatus === 200 && pubJson && pubJson.code === 0 && pubJson.data.work.title) {
        ok('POST /shares + GET /shares/:token（分享预览）', `url=${json.data.url}`);
      } else {
        throw new Error(`公开预览失败 status=${pubStatus}`);
      }
    } else {
      throw new Error(`status=${status} body=${JSON.stringify(json)}`);
    }
  } catch (e) {
    fail('POST /shares + GET /shares/:token（分享预览）', e);
  }

  console.log(`\n冒烟结果：${passed} 通过 / ${failed} 失败\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('\n冒烟脚本异常：', e);
  process.exit(1);
});
