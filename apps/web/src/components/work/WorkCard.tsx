import type { WorkDto } from '@mira/contracts';
import { FEATURES } from '../../config';
import { formatRelativeTime } from '../../utils/format';

interface WorkCardProps {
  work: WorkDto;
  onOpen?: () => void;
  onDuplicate?: () => void;
  onShare?: () => void;
  onDelete?: () => void;
  /** 选择模式（P1 R3 批量导出）：显示复选框，卡片点击=切换选中 */
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}

/** 作品卡：缩略图 + 标题/时间 + hover 操作（复制/分享/删除）；选择模式下显示复选框并切换点击行为 */
export function WorkCard({
  work,
  onOpen,
  onDuplicate,
  onShare,
  onDelete,
  selectable = false,
  selected = false,
  onToggleSelect,
}: WorkCardProps) {
  const gradient =
    work.canvasJson && typeof work.canvasJson === 'object'
      ? (work.canvasJson as { background?: { from?: string; to?: string } }).background
      : undefined;

  const background = gradient?.from && gradient?.to
    ? `linear-gradient(160deg, ${gradient.from}, ${gradient.to})`
    : undefined;

  const handleClick = () => {
    if (selectable) onToggleSelect?.();
    else onOpen?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter') handleClick();
  };

  return (
    <div
      className={`work-card${selectable ? ' selectable' : ''}${selected ? ' selected' : ''}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-pressed={selectable ? selected : undefined}
      onKeyDown={handleKeyDown}
    >
      {selectable && (
        <div
          className="work-check"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect?.();
          }}
          role="checkbox"
          aria-checked={selected}
          tabIndex={-1}
        >
          <input type="checkbox" checked={selected} readOnly tabIndex={-1} />
        </div>
      )}
      <div className="work-thumb" style={background ? { background } : undefined}>
        {work.thumbnailUrl ? (
          <img src={work.thumbnailUrl} alt={work.title} loading="lazy" />
        ) : (
          work.title
        )}
      </div>
      {!selectable && (
        <div className="work-actions" onClick={(e) => e.stopPropagation()}>
          {onDuplicate && (
            <button className="act-btn" title="复制" aria-label="复制" onClick={onDuplicate}>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <rect x="5" y="5" width="9" height="9" rx="2" stroke="currentColor" strokeWidth="1.4" />
                <path d="M11 5V3.5A1.5 1.5 0 009.5 2h-6A1.5 1.5 0 002 3.5v6A1.5 1.5 0 003.5 11H5" stroke="currentColor" strokeWidth="1.4" />
              </svg>
            </button>
          )}
          {FEATURES.sharing && onShare && (
            <button className="act-btn" title="分享" aria-label="分享" onClick={onShare}>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <circle cx="3.5" cy="8" r="2" stroke="currentColor" strokeWidth="1.4" />
                <circle cx="12.5" cy="3.5" r="2" stroke="currentColor" strokeWidth="1.4" />
                <circle cx="12.5" cy="12.5" r="2" stroke="currentColor" strokeWidth="1.4" />
                <path d="M5.2 6.8l6-2.6M5.2 9.2l6 2.6" stroke="currentColor" strokeWidth="1.4" />
              </svg>
            </button>
          )}
          {onDelete && (
            <button className="act-btn danger" title="删除" aria-label="删除" onClick={onDelete}>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <path d="M2.5 4h11M6.5 4V2.5h3V4M4 4l.7 9.5h6.6L12 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
        </div>
      )}
      <div className="work-info">
        <span className="title">{work.title}</span>
        <span className="time">{formatRelativeTime(work.createdAt)}</span>
      </div>
    </div>
  );
}
