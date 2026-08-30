import type { ReactNode } from 'react';

interface MorePanelProps {
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}

/** 高级选项折叠面板：「更多选项 ▾ / 收起选项 ▴」 */
export function MorePanel({ open, onToggle, children }: MorePanelProps) {
  return (
    <>
      <div className={`more-panel${open ? ' open' : ''}`}>{children}</div>
      <button className="more-toggle" onClick={onToggle} aria-expanded={open}>
        {open ? '收起选项 ▴' : '更多选项 ▾'}
      </button>
    </>
  );
}
