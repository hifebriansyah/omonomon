// Teka-Teki Gaib (Ghost Riddles) view component.
import { useEffect, useRef, useState } from "react";
import { deviceId } from "~/features/whispers/identity";
import { asset } from "~/lib/asset";
import { config } from "~/lib/config";
import type { GameProps } from "../types";
import { dailyRiddles, dateString, doneToday, LINES, markDone, matches, type Riddle, SCORE_EACH } from "./logic";
import { TEXT } from "./text";

export default function GhostRiddlesGame({ lang, char, chars, onOver, forceDate, forceAlreadyDone }: GameProps & { forceDate?: string; forceAlreadyDone?: boolean }) {
  const t = TEXT[lang] || TEXT.en;
  const [date] = useState(() => forceDate || dateString());
  const riddles = dailyRiddles(date);
  const [alreadyDone, setAlreadyDone] = useState(() => Boolean(forceAlreadyDone));
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [guess, setGuess] = useState("");
  const [busy, setBusy] = useState(false);
  const [finished, setFinished] = useState(false);
  const [say, setSay] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  const later = (fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      timersRef.current.delete(id);
      fn();
    }, ms);
    timersRef.current.add(id);
  };

  useEffect(() => {
    if (!forceAlreadyDone && doneToday(date)) setAlreadyDone(true);
    else inputRef.current?.focus();
    const timers = timersRef.current;
    return () => {
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, [date, forceAlreadyDone]);

  const ghostOf = (id: string) => chars.find((c) => c.id === id) || char;

  const finishRun = (finalScore: number) => {
    markDone(date, finalScore);
    setFinished(true);
    setSay(t.done(finalScore));
    later(() => onOver(finalScore, { char: riddles[riddles.length - 1].ghost }), 900);
  };

  const judge = async (r: Riddle, text: string): Promise<{ correct: boolean; reply: string }> => {
    if (matches(r, text)) return { correct: true, reply: "" };
    const api = config.API_URL;
    if (!api) return { correct: false, reply: "" };
    const res = await fetch(`${api.replace(/\/+$/, "")}/riddle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ character: r.ghost, riddle: r.en, answers: r.answers, guess: text, device: deviceId() }),
    });
    if (res.status === 429) throw Object.assign(new Error("limit"), { limit: true });
    if (!res.ok) throw new Error(String(res.status));
    return res.json();
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = guess.trim();
    if (!trimmed || busy || finished || alreadyDone) return;
    setBusy(true);
    setSay(t.thinking);
    const r = riddles[index];
    try {
      const v = await judge(r, trimmed);
      const lines = LINES[r.ghost];
      const line = v.reply || (v.correct ? lines.ok : lines.no)[lang] || (v.correct ? lines.ok : lines.no).en;
      setSay(line);
      const nextScore = score + (v.correct ? SCORE_EACH : 0);
      setScore(nextScore);
      const nextIdx = index + 1;
      later(() => {
        if (nextIdx < riddles.length) {
          setIndex(nextIdx);
          setGuess("");
          setSay("");
          setBusy(false);
          inputRef.current?.focus();
        } else {
          setBusy(false);
          finishRun(nextScore);
        }
      }, 1600);
    } catch (err) {
      const isLimit = Boolean((err as { limit?: boolean })?.limit);
      setSay(isLimit ? t.limit : t.error);
      setBusy(false);
      if (isLimit) {
        later(() => finishRun(score), 1200);
      }
    }
  };

  const currentRiddle = riddles[Math.min(index, riddles.length - 1)];
  const currentGhost = alreadyDone ? char : ghostOf(currentRiddle.ghost);
  const headerText = alreadyDone ? t.head : `${t.head} · ${t.of(Math.min(index + 1, riddles.length), riddles.length)} · ${currentGhost.name}`;
  const bubbleText = alreadyDone ? t.again : currentRiddle[lang] || currentRiddle.en;

  return (
    <div className="grid content-start gap-2.5 p-3.5">
      <p className="m-0 font-bold opacity-80">{headerText}</p>
      <div className="flex items-start gap-2.5">
        <img src={asset(currentGhost.head)} alt="" className="size-14 flex-none rounded-full bg-paper object-contain" />
        <p className="m-0 rounded-2xl bg-white px-3.5 py-2.5 font-comic leading-[1.35] text-ink">{bubbleText}</p>
      </div>
      {!alreadyDone && !finished && (
        <form autoComplete="off" onSubmit={onSubmit} className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            maxLength={60}
            aria-label={t.answer}
            placeholder={t.answer}
            value={guess}
            disabled={busy}
            onChange={(e) => setGuess(e.target.value)}
            className="min-w-0 flex-1 rounded-xl border-2 border-ink bg-white px-3 py-2.5 font-[inherit] text-ink"
          />
          <button
            type="submit"
            disabled={busy}
            className="cursor-pointer rounded-xl border-2 border-ink bg-candle px-4 py-2.5 font-[inherit] font-bold text-ink disabled:cursor-default disabled:opacity-60"
          >
            {t.send}
          </button>
        </form>
      )}
      <p role="status" className="m-0 min-h-[1.4em]">
        {say}
      </p>
    </div>
  );
}
