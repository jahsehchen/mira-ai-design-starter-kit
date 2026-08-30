import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { withAlpha } from '../../utils/color';

/** 文字块逻辑坐标（基于 1080×1350 逻辑画布） */
export interface TextBlockPos {
  x: number;
  y: number;
}

type BlockId = 'title' | 'subtitle' | 'price';

interface CanvasPreviewProps {
  gradientFrom: string;
  gradientTo: string;
  title: string;
  subtitle?: string;
  price?: string;
  titleColor?: string;
  subtitleColor?: string;
  imageUrl?: string | null;
  /** 标题字号（逻辑像素，画布宽 1080 为基准；非 DOM 像素） */
  fontSize?: number;
  /** 标题字间距（逻辑像素） */
  letterSpacing?: number;
  /** 底部遮罩强度 0-100（默认 45，0 关闭）——由 EditorPage 传入自适应有效强度（R4） */
  overlayOpacity?: number;
  /** 遮罩颜色（R4 换色联动）：EditorPage 传入主题色派生的协调深色调，默认纯黑（向后兼容） */
  maskColor?: string;
  titlePos?: TextBlockPos;
  subtitlePos?: TextBlockPos;
  pricePos?: TextBlockPos;
  /** 拖拽回调：x/y 为逻辑坐标，拖动中实时触发（仅预览，不入历史栈） */
  onBlockDrag?: (id: BlockId, x: number, y: number) => void;
  /** 拖拽开始回调（pointerdown）：调用方在此记录拖拽前快照 */
  onBlockDragStart?: (id: BlockId, x: number, y: number) => void;
  /** 拖拽结束回调（pointerup/pointercancel）：x/y 为最终逻辑坐标，调用方在此 commit 一次 */
  onBlockDragEnd?: (id: BlockId, x: number, y: number) => void;
}

/** 逻辑画布尺寸（canvasJson 固定 1080×1350，编辑器 DOM 按此比例缩放显示） */
const CANVAS_W = 1080;
const CANVAS_H = 1350;

/**
 * 画布预览（编辑器中心）：
 * - AI 底图 + 文字叠加：imageUrl 存在时底图铺满（cover），标题/副标题/价格文字显示在图上；
 *   无底图时回退渐变背景（NVIDIA Provider 的 background 是 type:'gradient' 且带 image 字段，需兼容）
 * - 底部渐变遮罩：透明→黑，强度由 overlayOpacity（0-100）控制，保障文字可读
 * - 三个文字块支持拖拽定位：原生 pointer events + setPointerCapture，坐标双向换算
 *   （getBoundingClientRect 比例换算，窗口 resize 自动正确）
 */
export function CanvasPreview({
  gradientFrom,
  gradientTo,
  title,
  subtitle,
  price,
  titleColor = '#FFFFFF',
  subtitleColor = 'rgba(255,255,255,0.9)',
  imageUrl,
  fontSize = 64,
  letterSpacing = 2,
  overlayOpacity = 45,
  maskColor = '#000000',
  titlePos = { x: 72, y: 800 },
  subtitlePos = { x: 72, y: 900 },
  pricePos = { x: 72, y: 1000 },
  onBlockDrag,
  onBlockDragStart,
  onBlockDragEnd,
}: CanvasPreviewProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  /**
   * 画布实际像素尺寸：用 state 缓存而非读 ref，以避免"首次 render 时 ref 尚未 attach → 块落在 0,0"
   * （首次 render 时 ref 还未赋值，getBoundingClientRect 无意义），通过 useEffect mount 后写入 state
   * 触发二次 render 修正位置；resize 用 ResizeObserver 持续同步。
   */
  const [canvasSize, setCanvasSize] = useState<{ w: number; h: number } | null>(null);
  const [draggingId, setDraggingId] = useState<BlockId | null>(null);
  const dragRef = useRef<{
    id: BlockId;
    startX: number;
    startY: number;
    startDomX: number;
    startDomY: number;
    lastX: number;
    lastY: number;
  } | null>(null);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setCanvasSize({ w: r.width, h: r.height });
    };
    update();
    window.addEventListener('resize', update);
    // 监听自身尺寸变化（侧栏折叠、wrap 缩放等场景）
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      window.removeEventListener('resize', update);
      ro.disconnect();
    };
  }, []);

  const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

  /** 逻辑坐标 → DOM 像素（按宽/高方向分别比例换算） */
  const toDom = (x: number, y: number) => {
    if (!canvasSize || canvasSize.w === 0 || canvasSize.h === 0) return { x: 0, y: 0 };
    return {
      x: (x / CANVAS_W) * canvasSize.w,
      y: (y / CANVAS_H) * canvasSize.h,
    };
  };

  /** 逻辑尺寸 → DOM 尺寸（按高度方向等比，保证字与画布比例一致） */
  const toDomSize = (size: number) => {
    if (!canvasSize || canvasSize.h === 0) return size;
    return (size / CANVAS_H) * canvasSize.h;
  };

  /** 按下：记录起始偏移并捕获指针（后续 move/up 都命中当前块） */
  const startDrag = (id: BlockId, e: ReactPointerEvent<HTMLDivElement>, pos: TextBlockPos) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      id,
      startX: pos.x,
      startY: pos.y,
      startDomX: e.clientX,
      startDomY: e.clientY,
      lastX: pos.x,
      lastY: pos.y,
    };
    setDraggingId(id);
    onBlockDragStart?.(id, pos.x, pos.y);
  };

  /** 拖动：按 DOM 位移换算成逻辑坐标位移，限制在画布内 */
  const moveDrag = (id: BlockId, e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== id || !canvasSize) return;
    if (canvasSize.w === 0 || canvasSize.h === 0) return;
    const dx = ((e.clientX - drag.startDomX) / canvasSize.w) * CANVAS_W;
    const dy = ((e.clientY - drag.startDomY) / canvasSize.h) * CANVAS_H;
    const x = Math.round(clamp(drag.startX + dx, 8, CANVAS_W - 8));
    const y = Math.round(clamp(drag.startY + dy, 8, CANVAS_H - 8));
    drag.lastX = x;
    drag.lastY = y;
    onBlockDrag?.(id, x, y);
  };

  /** 松手/取消：用最后一次逻辑坐标回调 onBlockDragEnd（调用方入栈一次） */
  const endDrag = () => {
    const drag = dragRef.current;
    if (drag) {
      onBlockDragEnd?.(drag.id, drag.lastX, drag.lastY);
    }
    dragRef.current = null;
    setDraggingId(null);
  };

  const blocks = [
    {
      id: 'title' as BlockId,
      text: title,
      pos: titlePos,
      size: fontSize,
      weight: 600,
      color: titleColor,
      spacing: letterSpacing,
      family: 'var(--font-display)',
      cls: 'c-block c-title',
    },
    {
      id: 'subtitle' as BlockId,
      text: subtitle ?? '',
      pos: subtitlePos,
      size: 28,
      weight: 400,
      color: subtitleColor,
      spacing: 0,
      family: 'var(--font-sans)',
      cls: 'c-block c-sub',
    },
    {
      id: 'price' as BlockId,
      text: price ?? '',
      pos: pricePos,
      size: 56,
      weight: 700,
      color: titleColor,
      spacing: 0,
      family: 'var(--font-display)',
      cls: 'c-block c-price',
    },
  ];

  return (
    <div
      ref={canvasRef}
      className="editor-canvas"
      style={{ background: imageUrl ? undefined : `linear-gradient(160deg, ${gradientFrom}, ${gradientTo})` }}
    >
      {/* AI 底图：存在时铺满画布（cover），文字叠加在其上层 */}
      {imageUrl && <img className="c-bg" src={imageUrl} alt="" />}

      {/* 底部渐变遮罩：透明→遮罩色（R4 换色联动），强度由 overlayOpacity 控制，保障文字可读 */}
      <div
        className="c-mask"
        style={{
          opacity: clamp(overlayOpacity, 0, 100) / 100,
          background: `linear-gradient(to top, ${withAlpha(maskColor, 1)}, ${withAlpha(maskColor, 0)})`,
        }}
      />

      {/* 文字层：标题 / 副标题 / 价格，绝对定位 + 可拖拽 */}
      {blocks.map((b) => {
        if (!b.text) return null;
        const dom = toDom(b.pos.x, b.pos.y);
        return (
          <div
            key={b.id}
            className={`${b.cls}${draggingId === b.id ? ' dragging' : ''}`}
            style={{
              left: dom.x,
              top: dom.y,
              fontSize: toDomSize(b.size),
              fontWeight: b.weight,
              color: b.color,
              letterSpacing: b.spacing ? toDomSize(b.spacing) : undefined,
              fontFamily: b.family,
            }}
            onPointerDown={(e) => startDrag(b.id, e, b.pos)}
            onPointerMove={(e) => moveDrag(b.id, e)}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            {b.text}
          </div>
        );
      })}

      {draggingId && <div className="c-drag-hint">松开保存位置</div>}
    </div>
  );
}