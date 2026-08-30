import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ERROR_CODES, type StylePreset, type WorkDto } from '@mira/contracts';
import { aiApi, worksApi } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { useWorksStore } from '../../stores/worksStore';
import { useUiStore } from '../../stores/uiStore';
import { CooldownError, useGenerationStore } from '../../stores/generationStore';
import { FEATURES } from '../../config';
import { useEditorHistory } from '../../hooks/useEditorHistory';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';
import { CanvasPreview } from '../../components/editor/CanvasPreview';
import type { TextBlockPos } from '../../components/editor/CanvasPreview';
import { ColorSwatches } from '../../components/editor/ColorSwatches';
import { SliderRow } from '../../components/editor/SliderRow';
import { MorePanel } from '../../components/editor/MorePanel';
import { adjustColor, isLight, withAlpha } from '../../utils/color';
import { computeAdaptiveMask, sampleImageBrightness } from '../../utils/mask';
import './app-views.css';

const THEME_COLORS = ['#2B4CFF', '#0D0F12', '#D9D4CC', '#E5F4EC', '#F5B84B', '#E86A33', '#7CC576', '#7A5CF0'];
/** 文字颜色色板：白 / 黑 / 墨蓝 / 品牌蓝 / 金 / 橙 / 绿 / 深墨 */
const TEXT_COLORS = ['#FFFFFF', '#23272B', '#1F2A44', '#2B4CFF', '#F5B84B', '#E86A33', '#7CC576', '#0D0F12'];

/** 从 canvasJson 解析出的元素结构（仅编辑器关心的字段） */
interface CanvasElement {
  id?: string;
  text?: string;
  x?: number;
  y?: number;
  fontSize?: number;
  color?: string;
  letterSpacing?: number;
}
interface ParsedCanvas {
  background?: { from?: string; to?: string; image?: string; overlayOpacity?: number };
  elements?: CanvasElement[];
}

interface EditorState {
  title: string;
  subtitle: string;
  price: string;
  themeColor: string;
  /** 标题/价格文字颜色（默认白色；叠加在底图上保证可读） */
  textColor: string;
  fontSize: number;
  letterSpacing: number;
  radius: number;
  opacity: number;
  /** 底部遮罩强度 0-100（默认 45） */
  overlayOpacity: number;
  titlePos: TextBlockPos;
  subtitlePos: TextBlockPos;
  pricePos: TextBlockPos;
  /** AI 底图 URL（优先取 canvasJson.background.image，兜底 work.thumbnailUrl） */
  imageUrl: string | null;
}

/** hex/rgb 颜色转带透明度已移入 utils/color.withAlpha（Q7 单一来源），此处不再重复定义 */

/** 文字块 id → 位置字段 patch */
function posPatchOf(id: string, x: number, y: number): Partial<EditorState> {
  if (id === 'title') return { titlePos: { x, y } };
  if (id === 'subtitle') return { subtitlePos: { x, y } };
  return { pricePos: { x, y } };
}

/**
 * V4 编辑器（P1 R1/R2）：
 * - R1 撤销/重做：所有可编辑操作走 commit()（patch 前状态入栈）；拖拽松手入栈一次；
 *   Ctrl/Cmd+Z 撤销、Ctrl/Cmd+Shift+Z / Ctrl+Y 重做（输入框焦点内也执行编辑器级撤销）；
 *   撤销/重做不触发保存；作品加载完成后 reset 历史（初始态即基线）。
 * - R2 AI 重绘：解析 prompt（关联 generation → 标题+描述兜底确认）→ regenerateForWork
 *   → 仅替换底图（canvasJson.background.image + thumbnailUrl）→ 自动保存 → 入历史。
 */
export default function EditorPage() {
  const { workId } = useParams<{ workId: string }>();
  const navigate = useNavigate();
  const updateWork = useWorksStore((s) => s.updateWork);
  const showToast = useUiStore((s) => s.showToast);
  const openConfirm = useUiStore((s) => s.openConfirm);

  const [work, setWork] = useState<WorkDto | null>(null);
  const [loading, setLoading] = useState(Boolean(workId));
  const [moreOpen, setMoreOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const [state, setState] = useState<EditorState>({
    title: '夏日柠檬茶',
    subtitle: '冰爽一夏 · 第二杯半价',
    price: '¥12.9',
    themeColor: '#2B4CFF',
    textColor: '#FFFFFF',
    fontSize: 32,
    letterSpacing: 2,
    radius: 12,
    opacity: 100,
    overlayOpacity: 45,
    titlePos: { x: 72, y: 800 },
    subtitlePos: { x: 72, y: 900 },
    pricePos: { x: 72, y: 1000 },
    imageUrl: null,
  });

  // R4 底图底部 40% 平均亮度（0-1）；null = 无底图 / 采样失败（走主题色保守下限）
  const [imageBrightness, setImageBrightness] = useState<number | null>(null);

  // R6 IME 组合标记：compositionstart→end 期间为 true，组合内 onChange 传 mergeWindowMs=Infinity（R6-3）
  const composingRef = useRef(false);

  // 最新 state 引用：commit/拖拽/快捷键需要读取"渲染后"的最新值
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  // R1 历史栈（50 步 FIFO，快照式；R6 输入合并语义在 hook 层）
  const history = useEditorHistory<EditorState>();
  const { canUndo, canRedo, push: pushHistory, undo: undoHistory, redo: redoHistory, reset: resetHistory } = history;

  // 拖拽起始快照（松手时入栈一次）
  const dragStartRef = useRef<EditorState | null>(null);

  /**
   * 统一编辑入口：patch 前状态入栈 → 更新（R1-1 覆盖全部可编辑状态）。
   * R6：传入 opts.inputKey（'title'|'subtitle'|'price'）即进入输入合并会话；
   * mergeWindowMs 缺省用 hook 内 INPUT_MERGE_DEBOUNCE_MS=800，IME 组合期传 Infinity。
   * 非输入操作不传 opts → 正常入栈并终结输入会话（R6-2 ③）。
   */
  const commit = (partial: Partial<EditorState>, opts?: { inputKey?: string; mergeWindowMs?: number }) => {
    if (opts?.inputKey) {
      pushHistory(stateRef.current, { mergeKey: opts.inputKey, mergeWindowMs: opts.mergeWindowMs });
    } else {
      pushHistory(stateRef.current);
    }
    setState((prev) => ({ ...prev, ...partial }));
  };

  const handleUndo = useCallback(() => {
    const prev = undoHistory(stateRef.current);
    if (prev) setState(prev);
  }, [undoHistory]);

  const handleRedo = useCallback(() => {
    const next = redoHistory(stateRef.current);
    if (next) setState(next);
  }, [redoHistory]);

  // 快捷键：Ctrl/Cmd+Z 撤销；Ctrl/Cmd+Shift+Z 与 Ctrl+Y 重做（输入框焦点内也执行）
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if (key === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleUndo, handleRedo]);

  // 加载作品：从 canvasJson 还原文字/颜色/位置/底图；完成后 reset 历史（初始态即基线）
  useEffect(() => {
    if (!workId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    worksApi
      .get(workId)
      .then((w) => {
        if (cancelled) return;
        setWork(w);
        const canvas = (w.canvasJson ?? {}) as ParsedCanvas;
        const els = canvas.elements ?? [];
        // 优先按 id 找元素，找不到按历史索引兜底（兼容旧数据）
        const elById = (id: string, idx: number) => els.find((e) => e.id === id) ?? els[idx];
        const elTitle = elById('title', 0);
        const elSub = elById('subtitle', 1);
        const elPrice = elById('price', 2);
        setState((prev) => ({
          ...prev,
          title: elTitle?.text ?? w.title,
          subtitle: elSub?.text ?? prev.subtitle,
          price: elPrice?.text ?? prev.price,
          themeColor: canvas.background?.from ?? prev.themeColor,
          textColor: elTitle?.color ?? prev.textColor,
          fontSize: elTitle?.fontSize ? Math.round(elTitle.fontSize / 2) : prev.fontSize,
          letterSpacing: elTitle?.letterSpacing ?? prev.letterSpacing,
          overlayOpacity: canvas.background?.overlayOpacity ?? prev.overlayOpacity,
          titlePos: { x: elTitle?.x ?? 72, y: elTitle?.y ?? 800 },
          subtitlePos: { x: elSub?.x ?? 72, y: elSub?.y ?? 900 },
          pricePos: { x: elPrice?.x ?? 72, y: elPrice?.y ?? 1000 },
          // 底图：NVIDIA Provider 把缩略图 URL 塞在 background.image；无则兜底作品缩略图
          imageUrl: canvas.background?.image ?? w.thumbnailUrl,
        }));
        // 历史基线 = 加载完成的初始状态（撤销不回加载前）
        resetHistory();
      })
      .catch(() => {
        if (!cancelled) showToast('作品加载失败', 'error');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workId, showToast, resetHistory]);

  // 换色联动：仅背景渐变由主题色派生（文字颜色独立由 textColor 控制）
  const derived = useMemo(() => {
    const light = isLight(state.themeColor);
    const from = light ? adjustColor(state.themeColor, -0.35) : state.themeColor;
    const to = light ? state.themeColor : adjustColor(state.themeColor, 0.45);
    return { from, to };
  }, [state.themeColor]);

  // R4 底图亮度采样：imageUrl 变化 → 重置 → 离屏采样（带 url 比对防竞态）；失败返回 null 走保守下限
  useEffect(() => {
    const url = state.imageUrl;
    setImageBrightness(null);
    if (!url) return;
    let cancelled = false;
    void sampleImageBrightness(url).then((v) => {
      if (!cancelled) setImageBrightness(v);
    });
    return () => {
      cancelled = true;
    };
  }, [state.imageUrl]);

  // R4 自适应遮罩：仅预览层派生（传给 CanvasPreview）；buildCanvasJson 仍写用户 overlayOpacity（R4-4 红线）
  const adaptiveMask = useMemo(
    () =>
      computeAdaptiveMask({
        themeColor: state.themeColor,
        gradientTo: derived.to,
        userOverlayOpacity: state.overlayOpacity,
        imageBrightness,
        hasImage: Boolean(state.imageUrl),
        textColor: state.textColor,
      }),
    [state.themeColor, derived.to, state.overlayOpacity, imageBrightness, state.imageUrl, state.textColor],
  );

  const buildCanvasJson = () => ({
    version: 1,
    width: 1080,
    height: 1350,
    background: {
      // 兼容 NVIDIA Provider：background 保持 type:'gradient'，image 字段存 AI 底图
      type: 'gradient' as const,
      from: derived.from,
      to: derived.to,
      image: state.imageUrl ?? undefined,
      overlayOpacity: state.overlayOpacity,
    },
    elements: [
      {
        type: 'text',
        id: 'title',
        text: state.title,
        x: state.titlePos.x,
        y: state.titlePos.y,
        fontSize: state.fontSize * 2,
        fontWeight: 600,
        color: state.textColor,
        fontFamily: 'display',
        letterSpacing: state.letterSpacing,
      },
      {
        type: 'text',
        id: 'subtitle',
        text: state.subtitle,
        x: state.subtitlePos.x,
        y: state.subtitlePos.y,
        fontSize: 28,
        fontWeight: 400,
        color: withAlpha(state.textColor, 0.85),
        fontFamily: 'sans',
      },
      {
        type: 'text',
        id: 'price',
        text: state.price,
        x: state.pricePos.x,
        y: state.pricePos.y,
        fontSize: 56,
        fontWeight: 700,
        color: state.textColor,
        fontFamily: 'display',
      },
    ],
    palette: [state.themeColor, derived.to, state.textColor, '#23272B'],
  });

  const handleSave = async () => {
    if (!work) {
      showToast('请先从作品库打开一个作品', 'warning');
      return;
    }
    setSaving(true);
    try {
      await updateWork(work.id, {
        title: state.title,
        canvasJson: buildCanvasJson(),
      });
      showToast('已保存', 'success');
    } catch {
      showToast('保存失败，请稍后再试', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    if (work) navigate(`/app/export/${work.id}`);
    else showToast('请先打开一个作品', 'warning');
  };

  /** AI 优化排版（前端启发式，不调后端）：标题按长度自适应字号，三块自动对齐居中；整体算一步 */
  const handleAutoLayout = () => {
    const len = state.title.length || 1;
    const titleSize = len <= 4 ? 88 : len <= 8 ? 72 : len <= 12 ? 56 : 44;
    const subSize = 28;
    const priceSize = 56;
    // 粗略宽度估算（中文≈字号宽），按画布宽 1080 居中
    const centerX = (text: string, size: number) =>
      Math.max(24, Math.round((1080 - text.length * size) / 2));
    commit({
      fontSize: Math.round(titleSize / 2),
      titlePos: { x: centerX(state.title, titleSize), y: 780 },
      subtitlePos: { x: centerX(state.subtitle, subSize), y: 900 },
      pricePos: { x: centerX(state.price, priceSize), y: 1010 },
    });
    showToast('已优化排版：文字居中，字号按长度自适应', 'success');
  };

  // 拖拽：pointermove 实时预览不入栈；pointerup 才 commit 一次（R1-5）
  const handleBlockDragStart = useCallback((id: string) => {
    dragStartRef.current = structuredClone(stateRef.current);
  }, []);

  const handleBlockDrag = useCallback((id: string, x: number, y: number) => {
    setState((prev) => ({ ...prev, ...posPatchOf(id, x, y) }));
  }, []);

  const handleBlockDragEnd = useCallback(
    (id: string, x: number, y: number) => {
      const before = dragStartRef.current;
      dragStartRef.current = null;
      if (!before) return;
      const prevPos = id === 'title' ? before.titlePos : id === 'subtitle' ? before.subtitlePos : before.pricePos;
      // 点了没拖（位置未变化）不入栈
      if (prevPos.x === x && prevPos.y === y) return;
      pushHistory(before);
      setState((prev) => ({ ...prev, ...posPatchOf(id, x, y) }));
    },
    [pushHistory],
  );

  /**
   * AI 重绘（R2）：prompt 来源（R2-5）→ regenerateForWork（复用冷却/429/轮询）
   * → 仅替换底图 → 自动保存（R2-4）→ 成功才更新本地底图并入历史；失败不丢底图。
   */
  const handleRegenerate = async () => {
    if (!work || regenerating) return;
    const genStore = useGenerationStore.getState();
    if (genStore.cooldownRemainingSec > 0) {
      showToast(`生成太频繁，请 ${genStore.cooldownRemainingSec} 秒后再试`, 'warning');
      return;
    }

    // 1) prompt 解析（R2-5）：优先作品关联 generation 的原始 prompt + 风格；失败/无关联 → 标题+描述兜底并确认
    let prompt: string | undefined;
    let stylePreset: StylePreset | undefined;
    if (work.sourceGenerationId) {
      try {
        const gen = await aiApi.getGeneration(work.sourceGenerationId);
        if (gen.prompt) {
          prompt = gen.prompt;
          if (gen.stylePreset && gen.stylePreset !== '不限') {
            stylePreset = gen.stylePreset as StylePreset;
          }
        }
      } catch {
        // 获取失败 → 走兜底
      }
    }
    if (!prompt) {
      const fallback = [work.title, work.description].filter(Boolean).join('，') || work.title;
      const confirmed = await openConfirm({
        title: '未找到原始描述',
        description: `将使用作品标题/描述生成新底图：「${fallback}」`,
        confirmText: '继续重绘',
      });
      if (!confirmed) return;
      prompt = fallback;
    }

    setRegenerating(true);
    try {
      const result = await genStore.regenerateForWork({
        workId: work.id,
        prompt,
        stylePreset,
        options: { count: 1, autoMatch: true, simulateFailure: false },
      });

      // 2) 新底图 URL：优先 result.thumbnailUrl，兜底 canvasJson.background.image
      const newImageUrl =
        result.thumbnailUrl ??
        ((result.canvasJson as { background?: { image?: string } } | undefined)?.background?.image ?? null);
      if (!newImageUrl) {
        showToast('重绘完成，但未获取到新底图', 'warning');
        return;
      }

      // 3) 构造仅底图变化的新 canvasJson（文字/颜色/字号/位置/遮罩逐字段保留，R2-2）
      const base = buildCanvasJson();
      const nextCanvasJson = {
        ...base,
        background: { ...(base.background as Record<string, unknown>), image: newImageUrl },
      };

      // 4) 自动保存：PATCH 成功后才更新本地底图并入历史（失败不丢底图，R2-4）
      const updated = await updateWork(work.id, {
        canvasJson: nextCanvasJson,
        thumbnailUrl: newImageUrl,
      });

      // 5) 重绘前快照入栈（Ctrl+Z 可回旧底图）
      pushHistory(structuredClone(stateRef.current));
      setState((prev) => ({ ...prev, imageUrl: newImageUrl }));
      setWork(updated);
      showToast('已换新底图，文字排版保持不变', 'success');
    } catch (err) {
      if (err instanceof CooldownError) {
        showToast(`生成太频繁，请 ${err.remainingSec} 秒后再试`, 'warning');
        return;
      }
      if (err instanceof ApiError && err.code === ERROR_CODES.QUOTA_EXCEEDED) {
        if (FEATURES.payments) {
          const goUpgrade = await openConfirm({
            title: '本月生成额度已用完',
            description: '升级 Pro 可解锁更多生成次数',
            confirmText: '去升级',
          });
          if (goUpgrade) navigate('/app/subscribe');
        } else {
          // 订阅未开放：不引导升级，仅提示
          showToast('本月生成额度已用完', 'warning');
        }
        return;
      }
      showToast(err instanceof Error ? err.message : '重绘失败，底图保持不变', 'error');
    } finally {
      setRegenerating(false);
    }
  };

  if (!workId) {
    return (
      <EmptyState
        icon={
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <path d="M20 5.5l6.5 6.5L11 27.5H5v-6L20 5.5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          </svg>
        }
        title="从作品开始编辑"
        description="在「我的作品」里挑一个，点进去就能改字、换色、调字号"
        action={
          <Button onClick={() => navigate('/app/gallery')}>去作品库看看</Button>
        }
      />
    );
  }

  if (loading) {
    return <div style={{ padding: 48, textAlign: 'center', color: 'var(--color-text-tertiary)' }}>加载中…</div>;
  }

  return (
    <div className="fade-in">
      <div className="view-head">
        <div>
          <h1>编辑器</h1>
          <p>改字、换色、拖一拖就完成</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button variant="secondary" onClick={handleSave} loading={saving}>
            保存
          </Button>
          <Button onClick={handleExport}>导出作品</Button>
        </div>
      </div>

      <div className="editor-toolbar">
        <button className="tool-btn active">✏️ 文字</button>
        <button className="tool-btn">🎨 颜色</button>
        <button className="tool-btn">🖼 图片</button>
        <button className="tool-btn" onClick={handleRegenerate} disabled={regenerating || !work}>
          {regenerating ? '⏳ 重绘中…' : '🪄 AI 重绘'}
        </button>
        <button className="tool-btn" onClick={handleUndo} disabled={!canUndo}>
          ↩️ 撤销
        </button>
        <button className="tool-btn" onClick={handleRedo} disabled={!canRedo}>
          ↪️ 重做
        </button>
      </div>

      <div className="editor-shell">
        <div className="editor-canvas-wrap">
          <CanvasPreview
            gradientFrom={derived.from}
            gradientTo={derived.to}
            title={state.title}
            subtitle={state.subtitle}
            price={state.price}
            titleColor={state.textColor}
            subtitleColor={withAlpha(state.textColor, 0.85)}
            imageUrl={state.imageUrl}
            fontSize={state.fontSize * 2}
            letterSpacing={state.letterSpacing}
            overlayOpacity={adaptiveMask.effectiveOpacity}
            maskColor={adaptiveMask.maskColor}
            titlePos={state.titlePos}
            subtitlePos={state.subtitlePos}
            pricePos={state.pricePos}
            onBlockDrag={handleBlockDrag}
            onBlockDragStart={handleBlockDragStart}
            onBlockDragEnd={handleBlockDragEnd}
          />
        </div>

        <Card style={{ alignSelf: 'start' }}>
          <div className="panel-section">
            <h4>标题文字</h4>
            <Input
              value={state.title}
              maxLength={20}
              onChange={(e) =>
                commit(
                  { title: e.target.value },
                  { inputKey: 'title', mergeWindowMs: composingRef.current ? Infinity : undefined },
                )
              }
              onCompositionStart={() => (composingRef.current = true)}
              onCompositionEnd={() => (composingRef.current = false)}
            />
            <div style={{ marginTop: 12 }}>
              <Input
                value={state.subtitle}
                maxLength={40}
                onChange={(e) =>
                  commit(
                    { subtitle: e.target.value },
                    { inputKey: 'subtitle', mergeWindowMs: composingRef.current ? Infinity : undefined },
                  )
                }
                onCompositionStart={() => (composingRef.current = true)}
                onCompositionEnd={() => (composingRef.current = false)}
              />
            </div>
            <div style={{ marginTop: 12 }}>
              <Input
                value={state.price}
                maxLength={20}
                onChange={(e) =>
                  commit(
                    { price: e.target.value },
                    { inputKey: 'price', mergeWindowMs: composingRef.current ? Infinity : undefined },
                  )
                }
                onCompositionStart={() => (composingRef.current = true)}
                onCompositionEnd={() => (composingRef.current = false)}
              />
            </div>
          </div>

          <div className="panel-section">
            <h4>主题色（联动背景渐变）</h4>
            <ColorSwatches
              colors={THEME_COLORS}
              active={state.themeColor}
              onSelect={(color) => commit({ themeColor: color })}
            />
          </div>

          <div className="panel-section">
            <h4>文字颜色</h4>
            <ColorSwatches
              colors={TEXT_COLORS}
              active={state.textColor}
              onSelect={(color) => commit({ textColor: color })}
            />
          </div>

          <div className="panel-section">
            <h4>标题字号</h4>
            <SliderRow label="小" min={16} max={64} value={state.fontSize} onChange={(v) => commit({ fontSize: v })} />
          </div>

          <MorePanel open={moreOpen} onToggle={() => setMoreOpen((v) => !v)}>
            <div className="panel-section">
              <h4>高级选项（进阶）</h4>
              <SliderRow label="字间距" min={0} max={20} value={state.letterSpacing} onChange={(v) => commit({ letterSpacing: v })} />
              <SliderRow label="遮罩强度" min={0} max={100} value={state.overlayOpacity} onChange={(v) => commit({ overlayOpacity: v })} suffix="%" />
              <SliderRow label="圆角" min={0} max={40} value={state.radius} onChange={(v) => commit({ radius: v })} />
              <SliderRow label="透明度" min={0} max={100} value={state.opacity} onChange={(v) => commit({ opacity: v })} suffix="%" />
              <div style={{ marginTop: 12 }}>
                <Button variant="secondary" block onClick={handleAutoLayout}>
                  ✨ AI 优化排版
                </Button>
              </div>
            </div>
          </MorePanel>
        </Card>
      </div>
    </div>
  );
}
