// A short message near the bottom ("Bond level 3 with ...", "Quest done ..."). Several are shown one after the other, 3.2 s each.
import { useEffect } from "react";
import { create } from "zustand";

interface ToastState {
  queue: string[];
  push: (lines: string | string[]) => void;
  shift: () => void;
}

export const useToasts = create<ToastState>((set) => ({
  queue: [],
  push: (lines) => set((s) => ({ queue: [...s.queue, ...([] as string[]).concat(lines).filter(Boolean)] })),
  shift: () => set((s) => ({ queue: s.queue.slice(1) })),
}));

/** Show one or more messages (works outside React too). */
export const toast = (lines: string | string[]) => useToasts.getState().push(lines);

export function ToastView({ text, bottom = 84 }: { text: string; bottom?: number }) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{ bottom }}
      className="fixed left-1/2 z-30 max-w-[min(440px,calc(100%-24px))] -translate-x-1/2 animate-toast-in rounded-[14px] border-[3px] border-ink bg-white px-3.5 py-2 text-center font-comic text-[0.85rem] leading-[1.35] text-ink shadow-[3px_3px_0_var(--accent)]"
    >
      {text}
    </div>
  );
}

export function Toasts() {
  const current = useToasts((s) => s.queue[0]);
  const shift = useToasts((s) => s.shift);
  useEffect(() => {
    if (!current) return;
    const timer = setTimeout(shift, 3200);
    return () => clearTimeout(timer);
  }, [current, shift]);
  return current ? <ToastView key={current} text={current} /> : null;
}
