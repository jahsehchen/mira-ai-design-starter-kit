import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

export interface ConfirmState {
  title: string;
  description: string;
  confirmText?: string;
  danger?: boolean;
  resolve?: (ok: boolean) => void;
}

interface UiState {
  toasts: ToastItem[];
  confirm: ConfirmState | null;
  showToast: (message: string, type?: ToastType) => void;
  dismissToast: (id: number) => void;
  openConfirm: (options: Omit<ConfirmState, 'resolve'>) => Promise<boolean>;
  closeConfirm: (result: boolean) => void;
}

let toastId = 0;
const TOAST_DURATION = 2600;

export const useUiStore = create<UiState>((set, get) => ({
  toasts: [],
  confirm: null,

  showToast: (message, type = 'info') => {
    const id = ++toastId;
    set((state) => ({ toasts: [...state.toasts, { id, message, type }] }));
    window.setTimeout(() => {
      get().dismissToast(id);
    }, TOAST_DURATION);
  },

  dismissToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },

  openConfirm: (options) =>
    new Promise<boolean>((resolve) => {
      set({ confirm: { ...options, resolve } });
    }),

  closeConfirm: (result) => {
    const { confirm } = get();
    confirm?.resolve?.(result);
    set({ confirm: null });
  },
}));
