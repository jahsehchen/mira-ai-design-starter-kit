import type { ReactNode } from 'react';
import { useUiStore, type ToastType } from '../../stores/uiStore';

const ICONS: Record<ToastType, ReactNode> = {
  success: (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="7" fill="var(--color-success-bg)" />
      <path d="M4.8 8.2l2.2 2.2 4.2-4.8" stroke="var(--color-success-text)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  error: (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="7" fill="var(--color-danger-bg)" />
      <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="var(--color-danger-text)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  warning: (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="7" fill="var(--color-warning-bg)" />
      <path d="M8 4.5v4M8 11.2v.1" stroke="var(--color-warning-text)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  info: (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="7" fill="var(--color-info-bg)" />
      <path d="M8 7.2v3.4M8 5.4v.1" stroke="var(--color-info-text)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
};

/**
 * Toast 浮层宿主（深色浮层）：
 * 移动端底部居中（安全区上方）/ 桌面端右上；自动 3s 消失。
 */
export function ToastHost() {
  const toasts = useUiStore((s) => s.toasts);

  return (
    <div className="toast-host" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast ${toast.type}`} role="status">
          <span className="toast-icon">{ICONS[toast.type]}</span>
          <span>{toast.message}</span>
        </div>
      ))}
    </div>
  );
}
