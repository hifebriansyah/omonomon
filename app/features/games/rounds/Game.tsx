// Night Rounds: rooms light up on a night shift; tap each one before its timer runs out.
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { asset } from "~/lib/asset";
import type { GameProps } from "../types";
import { createEngine, LIVES, ROOMS, type RoundsEngine, type RoundsEvent, TICK_MS } from "./logic";

export default function RoundsGame({ char, game, onOver, restarted, demo }: GameProps & { demo?: "idle" | "playing" | "over" }) {
  const { t } = useTranslation();
  const engineRef = useRef<RoundsEngine | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastRef = useRef(0);
  const calmAtRef = useRef(0);

  const [started, setStarted] = useState(Boolean(restarted || demo === "playing" || demo === "over"));
  const [running, setRunning] = useState(demo === "playing");
  const [status, setStatus] = useState<string>(demo === "playing" ? t("rdCalling") : "");
  const [lives, setLives] = useState<number>(demo === "over" ? 0 : LIVES);
  const [roomsView, setRoomsView] = useState<{ lit: boolean; left: number }[]>(() =>
    Array.from({ length: ROOMS }, (_, i) => ({ lit: demo === "playing" && i === 2, left: demo === "playing" && i === 2 ? 0.65 : 0 })),
  );
  const [flashes, setFlashes] = useState<Record<number, "ok" | "missed" | "idle" | undefined>>({});

  const stop = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRunning(false);
  };

  const syncView = () => {
    const eng = engineRef.current;
    if (!eng) return;
    const st = eng.state();
    setRoomsView(st.rooms.map((r) => ({ lit: r.lit, left: r.lit ? Math.max(0, (r.deadline - st.t) / r.window) : 0 })));
  };

  const flash = (i: number, cls: "ok" | "missed" | "idle") => {
    setFlashes((prev) => ({ ...prev, [i]: cls }));
    setTimeout(() => {
      setFlashes((prev) => ({ ...prev, [i]: undefined }));
    }, 450);
  };

  const handleEvents = (events: RoundsEvent[]) => {
    const eng = engineRef.current;
    if (!eng) return;
    for (const e of events) {
      if (e.type === "ok") {
        flash(e.i, "ok");
        setStatus(t("rdThanks"));
        calmAtRef.current = eng.state().t + 1.5;
      } else if (e.type === "miss") {
        flash(e.i, "missed");
        setStatus(t("rdMissed"));
        setLives(eng.state().lives);
        calmAtRef.current = eng.state().t + 1.5;
      } else if (e.type === "idle") {
        flash(e.i, "idle");
      } else if (e.type === "over") {
        stop();
        syncView();
        onOver(eng.state().score);
      }
    }
  };

  const begin = () => {
    stop();
    const eng = createEngine();
    engineRef.current = eng;
    setStarted(true);
    setRunning(true);
    setLives(LIVES);
    setFlashes({});
    setStatus(t("rdCalling"));
    calmAtRef.current = 0;
    lastRef.current = performance.now();
    syncView();
    timerRef.current = setInterval(() => {
      const now = performance.now();
      const dt = Math.min(0.25, (now - lastRef.current) / 1000);
      lastRef.current = now;
      handleEvents(eng.tick(dt));
      if (!eng.state().over) {
        syncView();
        if (eng.state().t > calmAtRef.current) setStatus(t("rdCalling"));
      }
    }, TICK_MS);
  };

  const onTap = (i: number) => {
    if (!engineRef.current || !timerRef.current) return;
    handleEvents(engineRef.current.tap(i));
    syncView();
  };

  useEffect(() => {
    if (restarted && !demo) begin();
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key >= "1" && e.key <= String(ROOMS)) onTap(Number(e.key) - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const disabled = !started || !running;

  return (
    <>
      <img src={asset(char.stage)} alt="" className="h-auto max-h-[120px] w-24 object-contain [filter:drop-shadow(0_4px_0_rgba(0,0,0,0.3))]" />
      <p aria-live="polite" className="m-0 min-h-[1.5em] font-comic text-[1.05rem] text-white">
        {status}
      </p>
      <div role="group" aria-label={game.title} className="grid w-[min(340px,100%)] grid-cols-3 gap-3">
        {roomsView.map((r, i) => {
          const fl = flashes[i];
          const cls =
            fl === "ok"
              ? "bg-good text-ink"
              : fl === "missed"
                ? "animate-shake bg-[#c0392b] text-white"
                : r.lit
                  ? "scale-104 bg-[#ffd966] text-ink shadow-[0_0_22px_6px_rgba(255,217,102,0.65),3px_3px_0_rgba(0,0,0,0.5)]"
                  : fl === "idle"
                    ? "animate-shake bg-[#2b3050] text-[#8d96c4]"
                    : "bg-[#2b3050] text-[#8d96c4]";
          return (
            <button
              key={i}
              type="button"
              disabled={disabled}
              aria-label={t("rdRoom", { i: i + 1 })}
              onClick={() => onTap(i)}
              style={{ "--left": r.left.toFixed(3) } as CSSProperties}
              className={`relative grid aspect-[1.15] place-items-center overflow-hidden rounded-card border-[3px] border-ink shadow-[3px_3px_0_rgba(0,0,0,0.5)] transition-[background,transform,box-shadow] duration-150 focus-visible:outline-[3px] focus-visible:outline-offset-[3px] focus-visible:outline-white enabled:cursor-pointer disabled:cursor-default ${cls}`}
            >
              <span className="font-comic text-[1.6rem]">{i + 1}</span>
              <span className={`absolute right-2 bottom-[7px] left-2 h-[5px] overflow-hidden rounded-[3px] bg-black/35 ${r.lit ? "opacity-100" : "opacity-0"}`}>
                <i
                  style={{ width: `${r.left * 100}%` }}
                  className="block h-full rounded-[3px] bg-[linear-gradient(90deg,#e0603a,#14151a)]"
                />
              </span>
            </button>
          );
        })}
      </div>
      <p aria-live="polite" data-left={lives} className="m-0 min-h-[1.2em] text-[0.8rem] text-muted">
        {started ? t("rdLives", { count: lives }) : ""}
      </p>
      {!started && (
        <button
          type="button"
          onClick={begin}
          className="cursor-pointer rounded-xl border-2 border-ink bg-[var(--accent)] px-[22px] py-[9px] font-[inherit] font-bold text-ink shadow-[3px_3px_0_rgba(0,0,0,0.55)]"
        >
          {t("rdBegin")}
        </button>
      )}
    </>
  );
}
