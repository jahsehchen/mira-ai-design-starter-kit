/**
 * MIRA·弥画 e2e 浏览器封装：直驱系统 Chrome（headless），不下载浏览器。
 *
 * executablePath 默认系统 Chrome；支持 CHROME_PATH 环境变量覆盖（CI 可用 Edge/自定义路径）。
 * 使用 playwright-core（根 node_modules 已装，禁止重装/卸载）。
 */
import { chromium } from 'playwright-core';

export const DEFAULT_CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

/**
 * 启动 headless Chrome。
 * @returns {Promise<import('playwright-core').Browser>}
 */
export async function launchBrowser() {
  const executablePath = process.env.CHROME_PATH || DEFAULT_CHROME_PATH;
  return chromium.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu'],
  });
}
