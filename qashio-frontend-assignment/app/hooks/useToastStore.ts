'use client';

import { create } from 'zustand';

type ToastSeverity = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  severity: ToastSeverity;
}

interface ToastStoreState {
  toast: Toast | null;
  showToast: (message: string, severity?: ToastSeverity) => void;
  hideToast: () => void;
}


export const useToastStore = create<ToastStoreState>((set) => ({
  toast: null,
  showToast: (message, severity = 'success') =>
    set({ toast: { id: Date.now(), message, severity } }),
  hideToast: () => set({ toast: null }),
}));
