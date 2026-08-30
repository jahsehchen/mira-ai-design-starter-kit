import { useCallback, useRef, useState } from 'react';

/** 历史栈上限（PRD R1-4）：第 51 步丢最旧，仍可连续回退 50 步 */
export const EDITOR_HISTORY_LIMIT = 50;

/** R6 输入合并窗口（PRD R6-1）：同框连续输入 800ms 内合并为一步；常量可配置 */
export const INPUT_MERGE_DEBOUNCE_MS = 800;

/** R6 push 选项：输入合并语义 */
export interface PushOptions {
  /**
   * 输入会话键（'title' | 'subtitle' | 'price'）；缺省 = 非输入操作，正常入栈并终止输入会话。
   * 相同 mergeKey 且窗口内（now - lastAt < mergeWindowMs）→ skip-push（合并）。
   */
  mergeKey?: string;
  /** 合并窗口（默认 INPUT_MERGE_DEBOUNCE_MS；IME 组合期传 Infinity 使组合内无条件合并，R6-3） */
  mergeWindowMs?: number;
}

/**
 * 编辑器撤销/重做历史（P1 R1 + P2 R6 输入合并）：
 * - 快照式：push 时 structuredClone 深拷贝（EditorState 仅十几个字段，开销极小）
 * - undoStack 最新在末尾；push 超限 shift()（FIFO 丢最旧）
 * - undo/redo 返回目标快照由调用方 setState；撤销/重做不触发保存（R1-5）
 * - reset() 双栈清空：作品加载完成后调用，当前 state 即基线，撤销不回加载前
 *
 * R6 合并语义（工程红线）：合并 = skip-push（不新增、不清 redo、仅更新 lastAt）。
 * 因为 push 的是「变更前快照」，连续输入第 N 个字符时栈顶恰好是「会话起点快照 S0」，
 * 覆盖栈顶会把 S0 换成中间态，导致撤销只回退一字符；skip-push 保持栈恒为 [..., S0]，
 * 一次撤销回到整个会话前（架构 §1.3 推演）。
 */
export interface EditorHistory<T> {
  undoStack: T[];
  redoStack: T[];
  push: (snapshot: T, options?: PushOptions) => void;
  undo: (current: T) => T | null;
  redo: (current: T) => T | null;
  reset: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function useEditorHistory<T>(limit: number = EDITOR_HISTORY_LIMIT): EditorHistory<T> {
  const undoStackRef = useRef<T[]>([]);
  const redoStackRef = useRef<T[]>([]);
  // R6 输入会话标记：{ key, at } —— 与上次同 key 且窗口内 → skip-push；null = 无进行中会话
  const lastInputRef = useRef<{ key: string; at: number } | null>(null);
  // 触发重渲染，让 canUndo/canRedo 与按钮 disabled 联动实时更新
  const [, forceRender] = useState(0);

  const push = useCallback(
    (snapshot: T, options?: PushOptions) => {
      const now = Date.now();
      const mergeKey = options?.mergeKey;

      if (mergeKey) {
        const last = lastInputRef.current;
        const windowMs = options?.mergeWindowMs ?? INPUT_MERGE_DEBOUNCE_MS;
        if (last && last.key === mergeKey && now - last.at < windowMs) {
          // 合并 = skip-push：不新增、不清 redo 栈、仅更新 lastAt（R6 工程红线）
          lastInputRef.current = { key: mergeKey, at: now };
          return;
        }
        // 新会话起点：记录会话标记后正常入栈
        lastInputRef.current = { key: mergeKey, at: now };
      } else {
        // 非输入操作（颜色/滑杆/拖拽/AI 排版/AI 重绘）：入栈并终止输入会话（R6-2 ③）
        lastInputRef.current = null;
      }

      undoStackRef.current.push(structuredClone(snapshot));
      if (undoStackRef.current.length > limit) {
        undoStackRef.current.shift();
      }
      // 新操作清空重做栈（redo 分支失效）
      redoStackRef.current = [];
      forceRender((v) => v + 1);
    },
    [limit],
  );

  const undo = useCallback((current: T): T | null => {
    const prev = undoStackRef.current.pop();
    if (prev === undefined) return null;
    // 撤销后输入会话重置（R6-4）：下一次输入重新计一步
    lastInputRef.current = null;
    redoStackRef.current.push(structuredClone(current));
    forceRender((v) => v + 1);
    return prev;
  }, []);

  const redo = useCallback(
    (current: T): T | null => {
      const next = redoStackRef.current.pop();
      if (next === undefined) return null;
      // 重做后输入会话重置（R6-4）
      lastInputRef.current = null;
      undoStackRef.current.push(structuredClone(current));
      if (undoStackRef.current.length > limit) {
        undoStackRef.current.shift();
      }
      forceRender((v) => v + 1);
      return next;
    },
    [limit],
  );

  const reset = useCallback(() => {
    undoStackRef.current = [];
    redoStackRef.current = [];
    lastInputRef.current = null;
    forceRender((v) => v + 1);
  }, []);

  return {
    undoStack: undoStackRef.current,
    redoStack: redoStackRef.current,
    canUndo: undoStackRef.current.length > 0,
    canRedo: redoStackRef.current.length > 0,
    push,
    undo,
    redo,
    reset,
  };
}
