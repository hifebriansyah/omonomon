// The message box (was assets/scripts/composer.js): length limit (saves tokens), the counter, and sending.
// The Worker enforces its own cap too, because a page-only limit can be bypassed.
import { SendHorizontal } from "lucide-react";
import { type RefObject, useEffect, useState } from "react";
import { Icon } from "~/components/Icon";

export function Composer({
  placeholder,
  sendLabel,
  max,
  onSend,
  inputRef,
}: {
  placeholder: string;
  sendLabel: string;
  max: number;
  /** Return false to keep the text (the chat isn't ready). */
  onSend: (text: string) => boolean | void;
  inputRef?: RefObject<HTMLInputElement | null>;
}) {
  const [value, setValue] = useState("");
  const n = value.length;
  const counting = n >= max * 0.75;

  // A real keyboard, even on a phone or tablet (Bluetooth, a keyboard case): the first letter typed with nothing focused
  // goes into the message box. The on-screen keyboard never opens by itself.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.activeElement !== document.body || e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
      inputRef?.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [inputRef]);

  // Like WhatsApp, sending keeps the keyboard open: pressing the send button must not take the focus away from the
  // message box (that is what closes the phone keyboard).
  const keepFocus = (e: React.SyntheticEvent) => e.preventDefault();

  return (
    <form
      className="flex gap-2"
      autoComplete="off"
      onSubmit={(e) => {
        e.preventDefault();
        const text = value.trim().slice(0, max);
        if (!text) return;
        if (onSend(text) === false) return;
        setValue("");
        inputRef?.current?.focus();
      }}
    >
      <div className="relative flex min-w-0 flex-1">
        <input
          ref={inputRef}
          type="text"
          value={value}
          maxLength={max}
          placeholder={placeholder}
          onChange={(e) => setValue(e.target.value)}
          className={`min-w-0 flex-1 rounded-full border-[3px] border-ink bg-white py-[11px] pl-4 font-comic text-base text-ink shadow-[3px_3px_0_rgba(0,0,0,0.55)] outline-none focus:shadow-[3px_3px_0_var(--accent)] ${counting ? "pr-[66px]" : "pr-4"}`}
        />
        <span
          hidden={!counting}
          className={`pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 font-comic text-xs ${n >= max ? "font-bold text-[#c0392b]" : "text-[#6b7280]"}`}
        >
          {n}/{max}
        </span>
      </div>
      <button
        type="submit"
        aria-label={sendLabel}
        title={sendLabel}
        onPointerDown={keepFocus}
        onMouseDown={keepFocus}
        className="grid aspect-square flex-none cursor-pointer place-items-center rounded-full border-[3px] border-ink bg-[var(--accent)] p-0 text-ink shadow-[3px_3px_0_rgba(0,0,0,0.55)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0_rgba(0,0,0,0.55)]"
      >
        <Icon as={SendHorizontal} strokeWidth={2.4} className="ml-0.5 size-[1.35em]" />
      </button>
    </form>
  );
}
