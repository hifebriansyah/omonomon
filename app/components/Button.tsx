import type { ButtonHTMLAttributes } from "react";

type Variant = "comic" | "outline" | "danger" | "ghost";

const VARIANTS: Record<Variant, string> = {
  // the chunky comic button of the games and the chat (ink border, hard shadow, presses in)
  comic:
    "rounded-[14px] border-[3px] border-ink bg-[var(--accent)] px-4 py-2 font-comic font-bold text-ink shadow-comic active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0_var(--color-ink)] disabled:opacity-50",
  outline: "rounded-[10px] border border-[#4a4f5c] bg-transparent px-3 py-1.5 text-sm text-text hover:bg-white/8",
  danger: "rounded-[10px] border border-[#6b3a3a] bg-transparent px-3 py-1.5 text-sm text-[#ff8a80] hover:bg-white/8",
  ghost: "rounded-full bg-transparent p-2 text-muted hover:bg-white/8 hover:text-text",
};

export function Button({ variant = "comic", className = "", type = "button", ...rest }: { variant?: Variant } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={`cursor-pointer font-[inherit] disabled:cursor-default ${VARIANTS[variant]} ${className}`} {...rest} />;
}
