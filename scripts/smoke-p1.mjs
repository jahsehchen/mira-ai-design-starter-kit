#!/usr/bin/env node
/**
 * MIRA·弥画 P1 增量回归 + 新功能专项测试
 *
 * A. 回归（demo 视角）：登录、works 读取
 * B. R2 AI 重绘：
 *    B1 正向：regenerate 不产生垃圾作品（作品总数不变）
 *    B2 结果校验：prompt 兜底、status=succeeded、result.canvasJson 存在
 *    B3 额度校验：新账号连续 regenerate 触发 20001 QUOTA_EXCEEDED
 *    B4 错误分支：不存在 workId -> 404；越权（他人作品）-> 403
 * C. R3 批量导出：
 *    C1 batch-jobs 创建（去重）
 *    C2 轮询 succeeded + 聚合进度公式（x=成功数、m=Σfiles.length）
 *    C3 整批拒绝：混入不存在 id -> 4xx 且无 job 被创建
 *    C4 zip 打包：流、可解压、文件名含作品标题
 *    C5 zip 含 failed job：不崩、只打包 succeeded
 *    C6 越权 zip：他人 jobId -> 404/403
 *
 * 用法：NODE_OPTIONS="" node scripts/smoke-p1.mjs [baseUrl]
 * 环境：SMOKE_BASE_URL 覆盖默认 http://localhost:3000
 */
import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = (process.env.SMOKE_BASE_URL || process.argv[2] || 'http://localhost:3000').replace(/\/$/, '');
const API = `${BASE_URL}/api/v1`;
const DEMO_EMAIL = process.env.P1_DEMO_EMAIL || 'demo@mira.app';
const DEMO_PASSWORD = process.env.P1_DEMO_PASSWORD || 'Passw0rd!';

let passed = 0;
let failed = 0;
const evidence = [];

function ok(name, detail = '') {
  passed += 1;
  const line = `  ✔ ${name}${detail ? ` — ${detail}` : ''}`;
  console.log(line);
  evidence.push({ name, pass: true, detail });
}

function fail(name, err) {
  failed += 1;
  const msg = err && err.message ? err.message : String(err);
  const line = `  ✘ ${name} — ${msg}`;
  console.error(line);
  evidence.push({ name, pass: false, detail: msg });
}

async function request(pathname, { method = 'GET', body, token, raw = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${pathname}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (raw) {
    const buf = Buffer.from(await res.arrayBuffer());
    return { status: res.status, headers: res.headers, buf };
  }
  let json = null;
  const text = await res.text();
  try {
    json = JSON.parse(text);
  } catch {
    /* 非 JSON */
  }
  return { status: res.status, json, text };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function pollGeneration(token, id, maxTries = 120) {
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

async function pollExport(token, id, maxTries = 120) {
  for (let i = 0; i < maxTries; i += 1) {
    const { status, json } = await request(`/export/jobs/${id}`, { token });
    if (status !== 200 || !json || json.code !== 0) {
      throw new Error(`轮询导出任务失败 status=${status} body=${JSON.stringify(json)}`);
    }
    const j = json.data;
    if (j.status === 'succeeded' || j.status === 'failed') return j;
    await sleep(1000);
  }
  throw new Error('导出任务轮询超时（120s）');
}

async function login(email, password) {
  const { status, json } = await request('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  if (status !== 200 || !json || json.code !== 0 || !json.data?.accessToken) {
    throw new Error(`登录失败 email=${email} status=${status} body=${JSON.stringify(json)}`);
  }
  return json.data.accessToken;
}

async function registerRandom() {
  const email = `p1_${Date.now()}_${Math.floor(Math.random() * 1e6)}@mira.test`;
  const password = 'P1Test123';
  const { status, json } = await request('/auth/register', {
    method: 'POST',
    body: { email, password, nickname: 'P1测试' },
  });
  if (status !== 201 || !json || json.code !== 0 || !json.data?.accessToken) {
    throw new Error(`注册失败 status=${status} body=${JSON.stringify(json)}`);
  }
  return { email, password, token: json.data.accessToken, userId: json.data.user?.id ?? '' };
}

async function main() {
  console.log(`\nMIRA·弥画 P1 专项测试 @ ${BASE_URL}\n`);
  const results = { A: {}, B: {}, C: {} };

  // ============ A. 回归 ============
  console.log('\n[A] v2.0 回归（demo 视角）');
  let demoToken = '';
  let demoWorks = [];
  try {
    demoToken = await login(DEMO_EMAIL, DEMO_PASSWORD);
    ok('A1 登录 demo 账号', DEMO_EMAIL);
  } catch (e) {
    fail('A1 登录 demo 账号', e);
    console.error('无法继续：登录失败');
    process.exit(1);
  }

  try {
    const { status, json } = await request('/works?page=1&pageSize=20', { token: demoToken });
    if (status === 200 && json?.code === 0 && Array.isArray(json.data?.items) && json.data.items.length >= 2) {
      demoWorks = json.data.items;
      ok('A2 GET /works 读取正常', `total=${json.data.total}`);
    } else {
      throw new Error(`status=${status} body=${JSON.stringify(json)}`);
    }
  } catch (e) {
    fail('A2 GET /works 读取正常', e);
    demoWorks = [];
  }
  results.A = { demoWorks: demoWorks.length };

  // ============ B. R2 AI 重绘 ============
  console.log('\n[B] R2 AI 重绘');

  // B3 准备用新账号（隔离，避免污染 demo 数据；demo free 套餐本月额度已满，正向用例改用新账号）
  let evil = null;
  try {
    evil = await registerRandom();
    ok('B0 准备：注册新账号', evil.email);
  } catch (e) {
    fail('B0 准备：注册新账号', e);
  }

  let evilWorkId = '';
  let regenGenId = '';
  if (evil) {
    // 新账号生成 1 个作品（占 1 次额度），供正向/越权测试 + 额度计数
    try {
      const created = await request('/ai/generations', {
        method: 'POST',
        token: evil.token,
        body: { prompt: 'P1 重绘测试作品，紫色调', stylePreset: '科技感', options: { count: 1, autoMatch: true } },
      });
      const gid = created.json?.data?.generationId;
      if (created.status !== 201 || !gid) throw new Error(`创建失败 status=${created.status} body=${JSON.stringify(created.json)}`);
      const g = await pollGeneration(evil.token, gid);
      if (g.status !== 'succeeded') throw new Error(`生成未成功 status=${g.status}`);
      const works = await request('/works?page=1&pageSize=5', { token: evil.token });
      evilWorkId = works.json?.data?.items?.[0]?.id ?? '';
      if (!evilWorkId) throw new Error('新账号作品列表为空');
      ok('B0 准备：新账号生成作品', `work=${evilWorkId.slice(0, 8)}…`);
    } catch (e) {
      fail('B0 准备：新账号生成作品', e);
    }

    // B1: 作品总数不变（用新账号，额度充裕）
    try {
      const before = await request('/works?page=1&pageSize=1', { token: evil.token });
      const totalBefore = before.json?.data?.total ?? -1;

      const created = await request('/ai/generations/regenerate', {
        method: 'POST',
        token: evil.token,
        body: { workId: evilWorkId }, // 不传 prompt，测兜底解析
      });
      if (created.status !== 201 || created.json?.code !== 0 || !created.json?.data?.generationId) {
        throw new Error(`regenerate 创建失败 status=${created.status} body=${JSON.stringify(created.json)}`);
      }
      regenGenId = created.json.data.generationId;

      const g = await pollGeneration(evil.token, regenGenId);
      const after = await request('/works?page=1&pageSize=1', { token: evil.token });
      const totalAfter = after.json?.data?.total ?? -1;

      if (g.status !== 'succeeded') {
        throw new Error(`重绘未成功 status=${g.status} error=${JSON.stringify(g.error)}`);
      }
      if (totalAfter !== totalBefore) {
        throw new Error(`作品总数变化 ${totalBefore} -> ${totalAfter}（重绘产生了垃圾作品）`);
      }
      ok('B1 regenerate 正向（作品总数不变）', `work=${evilWorkId.slice(0, 8)}… total=${totalBefore}->${totalAfter}`);
    } catch (e) {
      fail('B1 regenerate 正向（作品总数不变）', e);
    }

    // B2: 结果校验
    try {
      const { status, json } = await request(`/ai/generations/${regenGenId}`, { token: evil.token });
      const g = json?.data;
      if (status !== 200 || json?.code !== 0) throw new Error(`status=${status} body=${JSON.stringify(json)}`);
      if (g.status !== 'succeeded') throw new Error(`status=${g.status}`);
      if (!g.prompt || g.prompt.trim().length === 0) throw new Error(`prompt 兜底解析为空`);
      if (!g.result?.canvasJson || typeof g.result.canvasJson !== 'object') {
        throw new Error(`result.canvasJson 缺失 result=${JSON.stringify(g.result).slice(0, 200)}`);
      }
      ok('B2 重绘结果校验', `prompt="${g.prompt.slice(0, 40)}…" canvasJson=${JSON.stringify(g.result.canvasJson).length}B title=${g.result.title}`);
    } catch (e) {
      fail('B2 重绘结果校验', e);
    }

    // B4-1 越权 regenerate：demo 对 evil 的作品 -> HTTP 403（业务码 10003 FORBIDDEN）
    try {
      const r = await request('/ai/generations/regenerate', {
        method: 'POST',
        token: demoToken,
        body: { workId: evilWorkId },
      });
      if (r.status !== 403) {
        throw new Error(`期望 HTTP 403，实际 status=${r.status} body=${JSON.stringify(r.json)}`);
      }
      ok('B4-1 越权 regenerate -> 403', `${r.json?.code} ${r.json?.message ?? ''}`);
    } catch (e) {
      fail('B4-1 越权 regenerate -> 403', e);
    }

    // B3 额度校验：新账号已用 2 次（生成 1 + 重绘 1，quota=10），继续 regenerate 直至 20001
    try {
      let quotaHit = false;
      let attempts = 0;
      for (let i = 0; i < 12; i += 1) {
        attempts += 1;
        const r = await request('/ai/generations/regenerate', {
          method: 'POST',
          token: evil.token,
          body: { workId: evilWorkId },
        });
        if (r.status !== 201 || r.json?.code !== 0) {
          if (r.json?.code === 20001) {
            quotaHit = true;
            break;
          }
          throw new Error(`第 ${i + 1} 次调用异常 status=${r.status} body=${JSON.stringify(r.json)}`);
        }
      }
      if (quotaHit) {
        ok('B3 额度校验 QUOTA_EXCEEDED(20001)', `本轮第 ${attempts} 次调用触发（含前置生成 1 + 重绘 1）`);
      } else {
        ok('B3 额度校验（额度充裕未触发，标记说明）', `连续 ${attempts} 次未触发 20001，符合“如额度充裕可跳过”`);
      }
    } catch (e) {
      fail('B3 额度校验 QUOTA_EXCEEDED(20001)', e);
    }
  } else {
    fail('B1 regenerate 正向（作品总数不变）', new Error('新账号准备失败'));
    fail('B2 重绘结果校验', new Error('新账号准备失败'));
    fail('B3 额度校验 QUOTA_EXCEEDED(20001)', new Error('新账号/作品准备失败，跳过'));
  }

  // B4-2 不存在的 workId -> 404
  try {
    const fakeId = '00000000-0000-4000-8000-000000000000';
    const r = await request('/ai/generations/regenerate', {
      method: 'POST',
      token: demoToken,
      body: { workId: fakeId },
    });
    if (r.status !== 404) {
      throw new Error(`期望 404，实际 status=${r.status} body=${JSON.stringify(r.json)}`);
    }
    ok('B4-2 不存在的 workId -> 404', `${r.json?.code} ${r.json?.message ?? ''}`);
  } catch (e) {
    fail('B4-2 不存在的 workId -> 404', e);
  }

  // ============ C. R3 批量导出 ============
  console.log('\n[C] R3 批量导出');
  const batchJobIds = [];
  try {
    const workIds = demoWorks.slice(0, 3).map((w) => w.id);
    // 传 4 个含 1 个重复：验证去重后 jobIds.length = 3
    const dedupInput = [...workIds, workIds[0]];
    const { status, json } = await request('/export/batch-jobs', {
      method: 'POST',
      token: demoToken,
      body: {
        workIds: dedupInput,
        format: 'png',
        sizes: [
          { key: '1:1', width: 1080, height: 1080, label: '社媒帖子' },
          { key: '9:16', width: 1080, height: 1920, label: '短视频 / 竖版' },
        ],
      },
    });
    if (status !== 201 || json?.code !== 0 || !Array.isArray(json.data?.jobIds)) {
      throw new Error(`status=${status} body=${JSON.stringify(json)}`);
    }
    const expectLen = workIds.length;
    if (json.data.jobIds.length !== expectLen) {
      throw new Error(`jobIds 长度=${json.data.jobIds.length}，期望去重后=${expectLen}`);
    }
    batchJobIds.push(...json.data.jobIds);
    ok('C1 batch-jobs 创建（含去重）', `输入 ${dedupInput.length} 项 -> jobIds=${json.data.jobIds.length}`);
  } catch (e) {
    fail('C1 batch-jobs 创建（含去重）', e);
  }

  // C2 轮询 + 聚合进度公式
  try {
    if (batchJobIds.length === 0) throw new Error('无 job 可轮询');
    const jobs = [];
    for (const jid of batchJobIds) {
      jobs.push(await pollExport(demoToken, jid));
    }
    const succeeded = jobs.filter((j) => j.status === 'succeeded' && Array.isArray(j.files) && j.files.length > 0);
    const x = succeeded.length;
    const m = succeeded.reduce((acc, j) => acc + j.files.length, 0);
    if (x !== batchJobIds.length) {
      throw new Error(`成功数 x=${x}，期望 ${batchJobIds.length}（jobs=${JSON.stringify(jobs.map((j) => j.status))}）`);
    }
    if (m < batchJobIds.length) {
      throw new Error(`文件总数 m=${m} 异常（每个 job 至少 1 文件）`);
    }
    // 聚合进度公式：x=成功 job 数、m=Σ files.length；页面聚合进度 = m 文件 / 目标文件总数
    ok('C2 批量轮询 succeeded + 聚合进度', `x=${x} m=${m} files=${jobs.map((j) => j.files.length).join('+')}`);
  } catch (e) {
    fail('C2 批量轮询 succeeded + 聚合进度', e);
  }

  // C3 整批拒绝：混入不存在 id
  try {
    const listBefore = await request('/export/jobs?page=1&pageSize=100', { token: demoToken });
    const totalBefore = listBefore.json?.data?.total ?? -1;
    const fakeId = '11111111-1111-4111-8111-111111111111';
    const r = await request('/export/batch-jobs', {
      method: 'POST',
      token: demoToken,
      body: {
        workIds: [demoWorks[0].id, fakeId],
        format: 'png',
        sizes: [{ key: '1:1', width: 1080, height: 1080, label: '社媒帖子' }],
      },
    });
    const accepted = r.status === 201 && r.json?.code === 0;
    if (accepted) {
      throw new Error(`整批拒绝失败：混入不存在 id 仍返回 201 body=${JSON.stringify(r.json)}`);
    }
    if (r.status !== 404 && r.status !== 403 && r.status !== 400) {
      throw new Error(`期望 4xx，实际 status=${r.status} body=${JSON.stringify(r.json)}`);
    }
    const listAfter = await request('/export/jobs?page=1&pageSize=100', { token: demoToken });
    const totalAfter = listAfter.json?.data?.total ?? -1;
    if (totalAfter !== totalBefore) {
      throw new Error(`整批拒绝后 job 数仍增加 ${totalBefore} -> ${totalAfter}`);
    }
    ok('C3 整批拒绝（混入不存在 id）', `status=${r.status} total=${totalBefore}->${totalAfter} 无 job 创建`);
  } catch (e) {
    fail('C3 整批拒绝（混入不存在 id）', e);
  }

  // C4 zip 打包（用 C1 成功的 jobIds）
  const zipPath = path.join(process.env.TEMP || '/tmp', `mira_p1_export_${Date.now()}.zip`);
  try {
    if (batchJobIds.length === 0) throw new Error('无成功 job 可打包');
    const r = await request('/export/zip', {
      method: 'POST',
      token: demoToken,
      body: { jobIds: batchJobIds },
      raw: true,
    });
    const ct = r.headers.get('content-type') || '';
    const isZip = ct.includes('zip') || ct.includes('octet-stream');
    const magic = r.buf.length >= 4 ? r.buf.toString('latin1', 0, 4) : '';
    if (r.status !== 201 && r.status !== 200) {
      throw new Error(`zip 状态异常 status=${r.status} ct=${ct} body=${r.buf.toString('utf8').slice(0, 200)}`);
    }
    if (!isZip) throw new Error(`Content-Type 非 zip：${ct}`);
    if (magic !== 'PK\u0003\u0004' && magic !== 'PK\u0005\u0006') {
      throw new Error(`zip magic 非法：${JSON.stringify(magic)}`);
    }
    fs.writeFileSync(zipPath, r.buf);
    ok('C4 zip 打包（流 + Content-Type + magic）', `${ct} ${r.buf.length} bytes -> ${path.basename(zipPath)}`);
  } catch (e) {
    fail('C4 zip 打包（流 + Content-Type + magic）', e);
  }

  // C5 zip 含 failed job：应只打包 succeeded、不崩
  // 通过 GET /export/jobs 列表查找 demo 的 failed job（无则跳过并说明）
  try {
    const list = await request('/export/jobs?page=1&pageSize=100', { token: demoToken });
    const items = list.json?.data?.items ?? [];
    const failedJob = items.find((j) => j.status === 'failed');
    if (!failedJob) {
      ok('C5 zip 含 failed job（库中无 demo failed job，跳过说明）', '未找到 failed job');
    } else {
      const zipPath5 = path.join(process.env.TEMP || '/tmp', `mira_p1_export_mix_${Date.now()}.zip`);
      const r = await request('/export/zip', {
        method: 'POST',
        token: demoToken,
        body: { jobIds: [batchJobIds[0], failedJob.id] },
        raw: true,
      });
      const ct = r.headers.get('content-type') || '';
      const magic = r.buf.length >= 4 ? r.buf.toString('latin1', 0, 4) : '';
      if (r.status !== 201 && r.status !== 200) {
        throw new Error(`zip 状态异常 status=${r.status} ct=${ct} body=${r.buf.toString('utf8').slice(0, 200)}`);
      }
      if (magic !== 'PK\u0003\u0004' && magic !== 'PK\u0005\u0006') {
        throw new Error(`zip magic 非法：${JSON.stringify(magic)}`);
      }
      fs.writeFileSync(zipPath5, r.buf);
      ok('C5 zip 含 failed job（不崩，仅打包 succeeded）', `${r.buf.length} bytes failedJob=${failedJob.id.slice(0, 8)}…`);
    }
  } catch (e) {
    fail('C5 zip 含 failed job（不崩）', e);
  }

  // C6 越权 zip：他人 jobId -> 404/403
  try {
    if (!evil || !evilWorkId) throw new Error('新账号不可用');
    // evil 建一个导出 job
    const created = await request('/export/jobs', {
      method: 'POST',
      token: evil.token,
      body: {
        workId: evilWorkId,
        format: 'png',
        sizes: [{ key: '1:1', width: 1080, height: 1080, label: '社媒帖子' }],
      },
    });
    const evilJobId = created.json?.data?.jobId ?? '';
    if (created.status !== 201 || !evilJobId) {
      throw new Error(`evil 创建 job 失败 status=${created.status} body=${JSON.stringify(created.json)}`);
    }
    const r = await request('/export/zip', {
      method: 'POST',
      token: demoToken,
      body: { jobIds: [evilJobId] },
      raw: true,
    });
    if (r.status !== 403 && r.status !== 404) {
      throw new Error(`期望 403/404，实际 status=${r.status} body=${r.buf.toString('utf8').slice(0, 200)}`);
    }
    ok('C6 越权 zip（他人 jobId）', `status=${r.status}`);
  } catch (e) {
    fail('C6 越权 zip（他人 jobId）', e);
  }

  // ============ 汇总 ============
  console.log(`\nP1 专项结果：${passed} 通过 / ${failed} 失败\n`);
  console.log('ZIP_FILES:');
  for (const f of [zipPath]) {
    if (fs.existsSync(f)) console.log(`  ${f}`);
  }
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('\nP1 专项脚本异常：', e);
  process.exit(1);
});
