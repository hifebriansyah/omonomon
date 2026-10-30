import type { ReactNode } from "react";

/** The comic speech bubble: the ghost's ("bot", tail down towards her) or the visitor's ("you", plain, right aligned). */
export function Bubble({ who = "bot", children, className = "", onClick }: { who?: "bot" | "you"; children: ReactNode; className?: string; onClick?: () => void }) {
  if (who === "you") {
    return (
      <div className={`ml-auto max-w-[85%] rounded-[18px_18px_6px_18px] border-[3px] border-ink bg-[var(--accent)] px-3.5 py-2 font-comic text-base leading-snug text-ink shadow-comic ${className}`}>
        {children}
      </div>
    );
  }
  return (
    <div
      onClick={onClick}
      className={`relative mb-[26px] max-w-[94%] flex-none cursor-pointer border-[3px] border-ink bg-[var(--bubble-bg)] px-[18px] py-3.5 text-center font-comic text-[1.15rem] leading-[1.35] text-[var(--bubble-ink)] shadow-[5px_5px_0_var(--color-ink)] [border-radius:26px_30px_28px_24px/30px_26px_32px_24px] ${className}`}
    >
      {children}
      {/* the tail */}
      <span
        aria-hidden="true"
        className="absolute -bottom-[22px] left-1/2 size-0 -translate-x-1/2 border-x-[12px] border-t-[22px] border-x-transparent border-t-ink"
      />
      <span
        aria-hidden="true"
        className="absolute -bottom-[15px] left-1/2 size-0 -translate-x-1/2 border-x-[8px] border-t-[15px] border-x-transparent border-t-[var(--bubble-bg)]"
      />
    </div>
  );
}

/** Three bouncing dots: the ghost is thinking. */
export function Dots() {
  return (
    <span className="inline-flex gap-1" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <i key={i} className="block size-2 animate-blink rounded-full bg-current motion-reduce:animate-none" style={{ animationDelay: `${i * 0.15}s` }} />
      ))}
    </span>
  );
}
