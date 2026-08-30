#!/usr/bin/env node
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const casesPath = path.join(root, 'apps/web/src/data/cases.json');
const publicDir = path.join(root, 'apps/web/public');
const expectedCount = 3;

function fail(message) {
  console.error(`[qa:cases] FAIL: ${message}`);
  process.exitCode = 1;
}

const data = JSON.parse(await readFile(casesPath, 'utf8'));
const cases = Array.isArray(data.cases) ? data.cases : [];

if (data.totalCases !== cases.length) fail(`totalCases=${data.totalCases}, actual=${cases.length}`);
if (cases.length !== expectedCount) fail(`expected ${expectedCount} demo cases, actual=${cases.length}`);

for (const item of cases) {
  for (const field of ['id', 'title', 'image', 'imageAlt', 'prompt', 'category', 'styles', 'scenes', 'featured']) {
    if (!(field in item)) fail(`case ${item.id ?? '?'} missing ${field}`);
  }
  if (!/^\/images\/demo\/[a-z0-9-]+\.svg$/i.test(String(item.image ?? ''))) {
    fail(`case ${item.id ?? '?'} uses non-demo image ${item.image}`);
    continue;
  }
  if ('sourceUrl' in item || 'githubUrl' in item || 'sourceLabel' in item) {
    fail(`case ${item.id ?? '?'} contains external provenance fields`);
  }
  await access(path.join(publicDir, item.image.replace(/^\//, ''))).catch(() => {
    fail(`case ${item.id ?? '?'} image file is missing`);
  });
}

if (!process.exitCode) console.log(`[qa:cases] PASS: ${cases.length} repository-owned demo cases are local and complete.`);
