// Gosip Pohon: the view. The rules are in logic.ts; this ticks the engine every 50 ms and draws the nine branches of the tree.
import { useEffect, useReducer, useRef, useState } from "react";
import type { GameProps } from "../types";
import { createEngine, SPOTS, TICK_MS, type Engine, type EngineEvent } from "./logic";
import { ICON, TEXT } from "./text";
import "./tree-gossip.css";

/** `makeEngine` is for Storybook only (a seeded or half-played run); the page always starts a fresh one. */
export default function Game({ onOver, lang, reduceMotion, makeEngine }: GameProps & { makeEngine?: () => Engine }) {
  const X = TEXT[lang === "id" ? "id" : "en"];
  const [engine] = useState(() => (makeEngine ? makeEngine() : createEngine()));
  const [, repaint] = useReducer((n: number) => n + 1, 0);
  const [msg, setMsg] = useState(X.begin);
  // The icon stays in place after a peeker hides, so it can slide back down (the old paint() only changed it on show).
  const [icons, setIcons] = useState<string[]>(() => engine.state().spots.map((s) => (s.kind ? ICON[s.kind] : "")));
  const [flash, setFlash] = useState<Record<number, "hit" | "bad">>({});
  const reported = useRef(false);
  const timers = useRef(new Set<number>());
  const report = useRef(onOver);
  useEffect(() => {
    report.current = onOver;
  });

  const flashSpot = (i: number, cls: "hit" | "bad") => {
    setFlash((f) => ({ ...f, [i]: cls }));
    const t = window.setTimeout(() => {
      timers.current.delete(t);
      setFlash((f) => {
        const { [i]: _gone, ...rest } = f;
        return rest;
      });
    }, 160);
    timers.current.add(t);
  };
  const handle = (events: EngineEvent[]) => {
    for (const e of events) {
      if (e.type === "show") {
        const icon = ICON[e.kind];
        setIcons((list) => list.map((x, k) => (k === e.i ? icon : x)));
      }
      if (e.type === "ok") {
        flashSpot(e.i, "hit");
        setMsg(e.streak >= 5 ? X.streak(e.streak) : "");
      }
      if (e.type === "bad") {
        flashSpot(e.i, "bad");
        setMsg(X.oops);
      }
      if (e.type === "over" && !reported.current) {
        reported.current = true;
        report.current(engine.state().score);
      }
    }
    repaint();
  };
  const press = (i: number) => {
    if (!reported.current) handle(engine.tap(i));
  };
  const latest = useRef({ handle, press });
  useEffect(() => {
    latest.current = { handle, press };
  });

  useEffect(() => {
    const pending = timers.current;
    let last = performance.now();
    const timer = setInterval(() => {
      const now = performance.now();
      const dt = Math.min(0.25, (now - last) / 1000);
      last = now;
      if (engine.state().over) return clearInterval(timer);
      latest.current.handle(engine.tick(dt));
    }, TICK_MS);
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^[1-9]$/.test(e.key)) latest.current.press(Number(e.key) - 1);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      clearInterval(timer);
      document.removeEventListener("keydown", onKey);
      pending.forEach(clearTimeout);
      pending.clear();
    };
  }, [engine]);

  const s = engine.state();
  return (
    <div className={`gp${reduceMotion ? " gp-reduce" : ""}`}>
      <div className="gp-bar">
        <span aria-live="polite">{`${X.score}: ${s.score}`}</span>
        <span>{X.lives(s.lives)}</span>
      </div>
      <div className="gp-msg" role="status">
        {msg}
      </div>
      <div className="gp-tree">
        <div className="gp-trunk" />
        <div className="gp-crown" />
        <div className="gp-grid">
          {Array.from({ length: SPOTS }, (_, i) => {
            const k = s.spots[i]?.kind ?? null;
            return (
              <button
                key={i}
                type="button"
                className={`gp-spot${flash[i] ? ` ${flash[i]}` : ""}`}
                data-k={k ?? undefined}
                aria-label={`${X.spot(i + 1)}, ${k ? X[k] : X.empty}`}
                onPointerDown={(e) => {
                  e.preventDefault();
                  press(i);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    press(i);
                  }
                }}
              >
                <b>{i + 1}</b>
                <i>{icons[i]}</i>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
