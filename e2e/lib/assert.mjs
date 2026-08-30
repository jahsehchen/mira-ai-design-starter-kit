/**
 * MIRA·弥画 e2e 轻量断言（零依赖）
 *
 * 断言失败抛可读 Error（带期望/实际值），由 runner 捕获并截图。
 * 与 scripts/smoke.mjs 的自写断言风格一致：可读、可排障。
 */
export function expect(actual) {
  return {
    /** 严格相等 */
    toBe(expected) {
      if (actual !== expected) {
        throw new Error(`断言失败: 期望=${JSON.stringify(expected)} 实际=${JSON.stringify(actual)}`);
      }
    },
    /** 真值断言（非空字符串/非零/非 null/非 undefined） */
    toBeTruthy() {
      if (!actual) {
        throw new Error(`断言失败: 期望为真值，实际=${JSON.stringify(actual)}`);
      }
    },
    /** 数值 > n */
    toBeGreaterThan(n) {
      if (typeof actual !== 'number' || !Number.isFinite(actual) || actual <= n) {
        throw new Error(`断言失败: 期望数值 > ${n}，实际=${JSON.stringify(actual)}`);
      }
    },
    /** 字符串/数组包含子项 */
    toContain(sub) {
      if (typeof actual === 'string') {
        if (!actual.includes(sub)) {
          throw new Error(`断言失败: 期望包含 ${JSON.stringify(sub)}，实际=${JSON.stringify(actual)}`);
        }
      } else if (Array.isArray(actual)) {
        if (!actual.includes(sub)) {
          throw new Error(`断言失败: 数组期望包含 ${JSON.stringify(sub)}，实际=${JSON.stringify(actual)}`);
        }
      } else {
        throw new Error(`断言失败: toContain 不支持类型 ${typeof actual}`);
      }
    },
    /** 正则匹配（对字符串） */
    toMatch(re) {
      if (!(re instanceof RegExp) || !re.test(String(actual))) {
        throw new Error(`断言失败: 期望匹配 ${re}，实际=${JSON.stringify(actual)}`);
      }
    },
  };
}
