// A panel that slides up from the bottom (whisper comments, menus). Closes on Escape and on the backdrop.
import { type ReactNode, useEffect, useRef } from "react";

export function Sheet({ open, onClose, label, children }: { open: boolean; onClose: () => void; label: string; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    panel.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85dvh] w-full max-w-page overflow-y-auto rounded-t-[18px] border-t border-edge bg-panel p-4 pb-[calc(16px+env(safe-area-inset-bottom))]"
      >
        {children}
      </div>
    </div>
  );
}
