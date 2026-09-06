'use client';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

export type ToastTone = 'ok' | 'warn' | 'err' | 'info';
export interface ToastInput {
  head: string;
  sub?: string;
  tone?: ToastTone;
  /** ms; defaults to 4200 */
  ttl?: number;
}
interface ToastItem extends ToastInput {
  id: number;
}

const ToastCtx = createContext<(t: ToastInput) => void>(() => {});

export function useToast() {
  return useContext(ToastCtx);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const push = useCallback((t: ToastInput) => {
    const id = ++seq.current;
    setItems((prev) => [...prev.slice(-3), { ...t, id }]);
    window.setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== id)), t.ttl ?? 4200);
  }, []);
  const value = useMemo(() => push, [push]);
  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="toast-region" aria-live="polite" aria-atomic="false">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.tone && t.tone !== 'info' ? `toast-${t.tone}` : ''}`} role="status">
            <div className="toast-head">{t.head}</div>
            {t.sub ? <div className="toast-sub">{t.sub}</div> : null}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
