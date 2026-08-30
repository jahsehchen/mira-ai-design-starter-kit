#!/usr/bin/env node
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const entry = path.join(root, 'apps/api/dist/main.js');

const env = {
  ...process.env,
  NODE_ENV: 'production',
  DB_PASSWORD: 'CHANGE_ME_STRONG_PASSWORD',
  JWT_ACCESS_SECRET: 'CHANGE_ME_ACCESS_SECRET_64_HEX',
  JWT_REFRESH_SECRET: 'CHANGE_ME_REFRESH_SECRET_64_HEX',
  PAYMENT_PROVIDER: 'mock',
  PAYMENT_MOCK_TOKEN: 'CHANGE_ME_MOCK_TOKEN',
};

const child = spawn(process.execPath, [entry], {
  cwd: root,
  env,
  stdio: ['ignore', 'pipe', 'pipe'],
});

let output = '';
child.stdout.on('data', (chunk) => { output += chunk.toString(); });
child.stderr.on('data', (chunk) => { output += chunk.toString(); });

const timer = setTimeout(() => {
  child.kill();
  console.error('[qa:security] FAIL: API did not reject placeholder production secrets before startup.');
  process.exitCode = 1;
}, 10_000);

child.on('exit', (code) => {
  clearTimeout(timer);
  const requiredNames = ['DB_PASSWORD', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'PAYMENT_MOCK_TOKEN'];
  const namesReported = requiredNames.every((name) => output.includes(name));
  const valuesLeaked = [
    env.DB_PASSWORD,
    env.JWT_ACCESS_SECRET,
    env.JWT_REFRESH_SECRET,
    env.PAYMENT_MOCK_TOKEN,
  ].some((value) => output.includes(value));

  if (code === 0 || !namesReported || valuesLeaked) {
    console.error('[qa:security] FAIL: production placeholder rejection is incomplete or leaked a value.');
    process.exitCode = 1;
    return;
  }
  console.log('[qa:security] PASS: production placeholders are rejected without echoing secret values.');
});
